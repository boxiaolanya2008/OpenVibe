import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, ToolResultMessage } from "@mariozechner/pi-ai";
import { globalMetrics, parallelExecute } from "./parallel-executor.js";

interface ToolCallInfo {
	id: string;
	name: string;
	args: Record<string, unknown>;
	tool: AgentTool<any> | undefined;
}
interface ToolExecutionResult {
	toolCallId: string;
	toolName: string;
	result: AgentToolResult<any>;
	isError: boolean;
	duration: number;
}
interface ExecuteToolsOptions {
	parallel?: boolean;
	maxConcurrency?: number;
	priority?: number;
}
export function extractToolCalls(
	tools: AgentTool<any>[] | undefined,
	assistantMessage: AssistantMessage,
): ToolCallInfo[] {
	const toolCalls = assistantMessage.content.filter((c) => c.type === "toolCall");
	return toolCalls.map((tc) => ({
		id: tc.id,
		name: tc.name,
		args: tc.arguments,
		tool: tools?.find((t) => t.name === tc.name),
	}));
}
async function executeSingleTool(
	toolCall: ToolCallInfo,
	signal?: AbortSignal,
	onUpdate?: (partialResult: AgentToolResult<any>) => void,
): Promise<ToolExecutionResult> {
	const startTime = Date.now();
	try {
		if (!toolCall.tool) {
			throw new Error(`Tool ${toolCall.name} not found`);
		}
		const result = await toolCall.tool.execute(toolCall.id, toolCall.args, signal, onUpdate);
		const duration = Date.now() - startTime;
		globalMetrics.record(`tool:${toolCall.name}`, duration);
		return {
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			result,
			isError: false,
			duration,
		};
	} catch (error) {
		const duration = Date.now() - startTime;
		globalMetrics.record(`tool:${toolCall.name}:error`, duration);
		return {
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			result: {
				content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
				details: {},
			},
			isError: true,
			duration,
		};
	}
}
export async function executeToolsParallel(
	tools: AgentTool<any>[] | undefined,
	assistantMessage: AssistantMessage,
	signal?: AbortSignal,
	onProgress?: (result: ToolExecutionResult) => void,
	options: ExecuteToolsOptions = {},
): Promise<ToolResultMessage[]> {
	const { parallel = true, maxConcurrency = 8 } = options;
	const toolCalls = extractToolCalls(tools, assistantMessage);
	if (toolCalls.length === 0) {
		return [];
	}
	if (toolCalls.length === 1 || !parallel) {
		const result = await executeSingleTool(toolCalls[0], signal);
		onProgress?.(result);
		return [toToolResultMessage(result)];
	}
	const results = await parallelExecute(toolCalls, (tc) => executeSingleTool(tc, signal), {
		concurrency: maxConcurrency,
	});
	results.forEach((result) => onProgress?.(result));
	return results.map(toToolResultMessage);
}
function toToolResultMessage(result: ToolExecutionResult): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: result.toolCallId,
		toolName: result.toolName,
		content: result.result.content,
		details: result.result.details,
		isError: result.isError,
		timestamp: Date.now(),
	};
}
export function canParallelize(tools: ToolCallInfo[]): boolean {
	return tools.length > 1;
}
export function groupToolsByDependency(tools: ToolCallInfo[]): ToolCallInfo[][] {
	return [tools];
}
export function getExecutionStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
	return globalMetrics.getAllStats();
}
export function resetExecutionStats(): void {
	globalMetrics.reset();
}
