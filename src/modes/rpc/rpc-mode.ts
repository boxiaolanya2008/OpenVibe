import type { AgentSession } from "../../core/agent-session.js";
import { attachJsonlLineReader, serializeJsonLine } from "./jsonl.js";
import type { RpcCommand, RpcResponse, RpcSessionState, RpcSlashCommand } from "./rpc-types.js";

export async function runRpcMode(session: AgentSession): Promise<void> {
	const output = (response: RpcResponse) => {
		process.stdout.write(serializeJsonLine(response));
	};

	const success = (id: string | undefined, command: string, data?: unknown): RpcResponse =>
		({
			id,
			type: "response",
			command: command as RpcResponse["command"],
			success: true,
			data,
		}) as RpcResponse;

	const error = (id: string | undefined, command: string, message: string): RpcResponse =>
		({
			id,
			type: "response",
			command: command as RpcResponse["command"],
			success: false,
			error: message,
		}) as RpcResponse;

	const shutdownRequested = false;
	const pendingExtensionRequests = new Map<string, { resolve: (response: unknown) => void }>();

	const handleCommand = async (command: RpcCommand): Promise<RpcResponse> => {
		const id = command.id;

		switch (command.type) {
			case "prompt": {
				await session.prompt(command.message, {
					images: command.images,
					streamingBehavior: command.streamingBehavior,
				});
				return success(id, "prompt");
			}
			case "steer": {
				await session.steer(command.message, command.images);
				return success(id, "steer");
			}
			case "follow_up": {
				await session.followUp(command.message, command.images);
				return success(id, "follow_up");
			}
			case "abort": {
				await session.abort();
				return success(id, "abort");
			}
			case "new_session": {
				const cancelled = !(await session.newSession({ parentSession: command.parentSession }));
				return success(id, "new_session", { cancelled });
			}
			case "get_state": {
				const state: RpcSessionState = {
					model: session.model,
					thinkingLevel: session.thinkingLevel,
					isStreaming: session.isStreaming,
					isCompacting: session.isCompacting,
					steeringMode: session.steeringMode,
					followUpMode: session.followUpMode,
					sessionFile: session.sessionFile,
					sessionId: session.sessionId,
					sessionName: session.sessionName,
					autoCompactionEnabled: session.autoCompactionEnabled,
					messageCount: session.messages.length,
					pendingMessageCount: session.pendingMessageCount,
				};
				return success(id, "get_state", state);
			}
			case "set_model": {
				return error(id, "set_model", "Model switching is disabled. Model is set during onboarding only.");
			}
			case "cycle_model": {
				return error(id, "cycle_model", "Model cycling is disabled. Model is set during onboarding only.");
			}
			case "get_available_models": {
				const model = session.modelRegistry.getModel();
				return success(id, "get_available_models", { models: model ? [model] : [] });
			}
			case "set_thinking_level": {
				session.setThinkingLevel(command.level);
				return success(id, "set_thinking_level");
			}
			case "cycle_thinking_level": {
				const level = session.cycleThinkingLevel();
				if (!level) {
					return success(id, "cycle_thinking_level", null);
				}
				return success(id, "cycle_thinking_level", { level });
			}
			case "set_steering_mode": {
				session.setSteeringMode(command.mode);
				return success(id, "set_steering_mode");
			}
			case "set_follow_up_mode": {
				session.setFollowUpMode(command.mode);
				return success(id, "set_follow_up_mode");
			}
			case "compact": {
				const result = await session.compact(command.customInstructions);
				return success(id, "compact", result);
			}
			case "set_auto_compaction": {
				session.setAutoCompactionEnabled(command.enabled);
				return success(id, "set_auto_compaction");
			}
			case "set_auto_retry": {
				session.setAutoRetryEnabled(command.enabled);
				return success(id, "set_auto_retry");
			}
			case "abort_retry": {
				session.abortRetry();
				return success(id, "abort_retry");
			}
			case "bash": {
				const result = await session.executeBash(command.command);
				return success(id, "bash", result);
			}
			case "abort_bash": {
				session.abortBash();
				return success(id, "abort_bash");
			}
			case "get_session_stats": {
				const stats = session.getSessionStats();
				return success(id, "get_session_stats", stats);
			}
			case "export_html": {
				const path = await session.exportToHtml(command.outputPath);
				return success(id, "export_html", { path });
			}
			case "switch_session": {
				const cancelled = !(await session.switchSession(command.sessionPath));
				return success(id, "switch_session", { cancelled });
			}
			case "fork": {
				const result = await session.fork(command.entryId);
				return success(id, "fork", { text: result.selectedText, cancelled: result.cancelled });
			}
			case "get_fork_messages": {
				const messages = session.getUserMessagesForForking();
				return success(id, "get_fork_messages", { messages });
			}
			case "get_last_assistant_text": {
				const text = session.getLastAssistantText();
				return success(id, "get_last_assistant_text", { text });
			}
			case "set_session_name": {
				const name = command.name.trim();
				if (!name) {
					return error(id, "set_session_name", "Session name cannot be empty");
				}
				session.setSessionName(name);
				return success(id, "set_session_name");
			}
			case "get_messages": {
				return success(id, "get_messages", { messages: session.messages });
			}
			case "get_commands": {
				const commands: RpcSlashCommand[] = [];
				for (const { command, extensionPath } of session.extensionRunner?.getRegisteredCommandsWithPaths() ?? []) {
					commands.push({
						name: command.name,
						description: command.description,
						source: "extension",
						path: extensionPath,
					});
				}
				for (const template of session.promptTemplates) {
					commands.push({
						name: template.name,
						description: template.description,
						source: "prompt",
						location: template.source as RpcSlashCommand["location"],
						path: template.filePath,
					});
				}
				for (const skill of session.resourceLoader.getSkills().skills) {
					commands.push({
						name: `skill:${skill.name}`,
						description: skill.description,
						source: "skill",
						location: skill.source as RpcSlashCommand["location"],
						path: skill.filePath,
					});
				}
				return success(id, "get_commands", { commands });
			}
			default: {
				const unknownCommand = command as { type: string };
				return error(undefined, unknownCommand.type, `Unknown command: ${unknownCommand.type}`);
			}
		}
	};

	let detachInput = () => {};

	async function checkShutdownRequested(): Promise<void> {
		if (!shutdownRequested) return;
		const currentRunner = session.extensionRunner;
		if (currentRunner?.hasHandlers("session_shutdown")) {
			await currentRunner.emit({ type: "session_shutdown" });
		}
		detachInput();
		process.stdin.pause();
		process.exit(0);
	}

	const handleInputLine = async (line: string) => {
		try {
			const parsed = JSON.parse(line);
			if (parsed.type === "extension_ui_response") {
				const response = parsed as { id: string };
				const pending = pendingExtensionRequests.get(response.id);
				if (pending) {
					pendingExtensionRequests.delete(response.id);
					pending.resolve(response);
				}
				return;
			}
			const command = parsed as RpcCommand;
			const response = await handleCommand(command);
			output(response);
			await checkShutdownRequested();
		} catch (e: any) {
			output(error(undefined, "parse", `Failed to parse command: ${e.message}`));
		}
	};

	detachInput = attachJsonlLineReader(process.stdin, (line) => {
		void handleInputLine(line);
	});

	return new Promise(() => {});
}
