import { type ImageContent, modelsAreEqual, supportsXhigh } from "@mariozechner/pi-ai";
import chalk from "chalk";
import fs from "fs";
import { createInterface } from "readline";
import { type Args, parseArgs, printHelp } from "./cli/args.js";
import { selectConfig } from "./cli/config-selector.js";
import { processFileArguments } from "./cli/file-processor.js";
import { listModels } from "./cli/list-models.js";
import { selectSession } from "./cli/session-picker.js";
import { APP_NAME, getAgentDir, getModelsPath, VERSION } from "./config.js";
import { globalAcceleratedClient } from "./core/accelerated-client.js";
import { AuthStorage } from "./core/auth-storage.js";
import { exportFromFile } from "./core/export-html/index.js";
import type { LoadExtensionsResult } from "./core/extensions/index.js";
import { KeybindingsManager } from "./core/keybindings.js";
import { ModelRegistry } from "./core/model-registry.js";
import { globalMultiGPUExecutor } from "./core/multi-gpu-executor.js";
import { DefaultPackageManager } from "./core/package-manager.js";
import { DefaultResourceLoader } from "./core/resource-loader.js";
import { type CreateAgentSessionOptions, createAgentSession } from "./core/sdk.js";
import { SessionManager } from "./core/session-manager.js";
import { SettingsManager } from "./core/settings-manager.js";
import { printTimings, time } from "./core/timings.js";
import { allTools } from "./core/tools/index.js";
import { runMigrations, showDeprecationWarnings } from "./migrations.js";
import { InteractiveMode, runPrintMode, runRpcMode } from "./modes/index.js";
import { initTheme, stopThemeWatcher } from "./modes/interactive/theme/theme.js";

function debugLog(stage: string, message: string, data?: any) {
	const logLine = `[${new Date().toISOString()}] [${stage}] ${message}${data ? ": " + JSON.stringify(data) : ""}\n`;
	fs.appendFileSync("debug.log", logLine);
}
async function readPipedStdin(): Promise<string | undefined> {
	if (process.stdin.isTTY) {
		return undefined;
	}
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => {
			resolve(data.trim() || undefined);
		});
		process.stdin.resume();
	});
}
function reportSettingsErrors(settingsManager: SettingsManager, context: string): void {
	const errors = settingsManager.drainErrors();
	for (const { scope, error } of errors) {
		console.error(chalk.yellow(`Warning (${context}, ${scope} settings): ${error.message}`));
		if (error.stack) {
			console.error(chalk.dim(error.stack));
		}
	}
}
function isTruthyEnvFlag(value: string | undefined): boolean {
	if (!value) return false;
	return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}
type PackageCommand = "install" | "remove" | "update" | "list";
interface PackageCommandOptions {
	command: PackageCommand;
	source?: string;
	local: boolean;
	help: boolean;
	invalidOption?: string;
}
function getPackageCommandUsage(command: PackageCommand): string {
	switch (command) {
		case "install":
			return `${APP_NAME} install <source> [-l]`;
		case "remove":
			return `${APP_NAME} remove <source> [-l]`;
		case "update":
			return `${APP_NAME} update [source]`;
		case "list":
			return `${APP_NAME} list`;
	}
}
function printPackageCommandHelp(command: PackageCommand): void {
	switch (command) {
		case "install":
			console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("install")}
Install a package and add it to settings.
Options:
  -l, --local    Install project-locally (.pi/settings.json)
Examples:
  ${APP_NAME} install npm:@foo/bar
  ${APP_NAME} install git:github.com/user/repo
  ${APP_NAME} install git:git@github.com:user/repo
  ${APP_NAME} install https:
  ${APP_NAME} install ssh:
  ${APP_NAME} install ./local/path
`);
			return;
		case "remove":
			console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("remove")}
Remove a package and its source from settings.
Options:
  -l, --local    Remove from project settings (.pi/settings.json)
Example:
  ${APP_NAME} remove npm:@foo/bar
`);
			return;
		case "update":
			console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("update")}
Update installed packages.
If <source> is provided, only that package is updated.
`);
			return;
		case "list":
			console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("list")}
List installed packages from user and project settings.
`);
			return;
	}
}
function parsePackageCommand(args: string[]): PackageCommandOptions | undefined {
	const [command, ...rest] = args;
	if (command !== "install" && command !== "remove" && command !== "update" && command !== "list") {
		return undefined;
	}
	let local = false;
	let help = false;
	let invalidOption: string | undefined;
	let source: string | undefined;
	for (const arg of rest) {
		if (arg === "-h" || arg === "--help") {
			help = true;
			continue;
		}
		if (arg === "-l" || arg === "--local") {
			if (command === "install" || command === "remove") {
				local = true;
			} else {
				invalidOption = invalidOption ?? arg;
			}
			continue;
		}
		if (arg.startsWith("-")) {
			invalidOption = invalidOption ?? arg;
			continue;
		}
		if (!source) {
			source = arg;
		}
	}
	return { command, source, local, help, invalidOption };
}
async function handlePackageCommand(args: string[]): Promise<boolean> {
	const options = parsePackageCommand(args);
	if (!options) {
		return false;
	}
	if (options.help) {
		printPackageCommandHelp(options.command);
		return true;
	}
	if (options.invalidOption) {
		console.error(chalk.red(`Unknown option ${options.invalidOption} for "${options.command}".`));
		console.error(chalk.dim(`Use "${APP_NAME} --help" or "${getPackageCommandUsage(options.command)}".`));
		process.exitCode = 1;
		return true;
	}
	const source = options.source;
	if ((options.command === "install" || options.command === "remove") && !source) {
		console.error(chalk.red(`Missing ${options.command} source.`));
		console.error(chalk.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
		process.exitCode = 1;
		return true;
	}
	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	reportSettingsErrors(settingsManager, "package command");
	const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
	packageManager.setProgressCallback((event) => {
		if (event.type === "start") {
			process.stdout.write(chalk.dim(`${event.message}\n`));
		}
	});
	try {
		switch (options.command) {
			case "install":
				await packageManager.install(source!, { local: options.local });
				packageManager.addSourceToSettings(source!, { local: options.local });
				console.log(chalk.green(`Installed ${source}`));
				return true;
			case "remove": {
				await packageManager.remove(source!, { local: options.local });
				const removed = packageManager.removeSourceFromSettings(source!, { local: options.local });
				if (!removed) {
					console.error(chalk.red(`No matching package found for ${source}`));
					process.exitCode = 1;
					return true;
				}
				console.log(chalk.green(`Removed ${source}`));
				return true;
			}
			case "list": {
				const globalSettings = settingsManager.getGlobalSettings();
				const projectSettings = settingsManager.getProjectSettings();
				const globalPackages = globalSettings.packages ?? [];
				const projectPackages = projectSettings.packages ?? [];
				if (globalPackages.length === 0 && projectPackages.length === 0) {
					console.log(chalk.dim("No packages installed."));
					return true;
				}
				const formatPackage = (pkg: (typeof globalPackages)[number], scope: "user" | "project") => {
					const source = typeof pkg === "string" ? pkg : pkg.source;
					const filtered = typeof pkg === "object";
					const display = filtered ? `${source} (filtered)` : source;
					console.log(`  ${display}`);
					const path = packageManager.getInstalledPath(source, scope);
					if (path) {
						console.log(chalk.dim(`    ${path}`));
					}
				};
				if (globalPackages.length > 0) {
					console.log(chalk.bold("User packages:"));
					for (const pkg of globalPackages) {
						formatPackage(pkg, "user");
					}
				}
				if (projectPackages.length > 0) {
					if (globalPackages.length > 0) console.log();
					console.log(chalk.bold("Project packages:"));
					for (const pkg of projectPackages) {
						formatPackage(pkg, "project");
					}
				}
				return true;
			}
			case "update":
				await packageManager.update(source);
				if (source) {
					console.log(chalk.green(`Updated ${source}`));
				} else {
					console.log(chalk.green("Updated packages"));
				}
				return true;
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Unknown package command error";
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
		return true;
	}
}
async function prepareInitialMessage(
	parsed: Args,
	autoResizeImages: boolean,
): Promise<{
	initialMessage?: string;
	initialImages?: ImageContent[];
}> {
	if (parsed.fileArgs.length === 0) {
		return {};
	}
	const { text, images } = await processFileArguments(parsed.fileArgs, { autoResizeImages });
	let initialMessage: string;
	if (parsed.messages.length > 0) {
		initialMessage = text + parsed.messages[0];
		parsed.messages.shift();
	} else {
		initialMessage = text;
	}
	return {
		initialMessage,
		initialImages: images.length > 0 ? images : undefined,
	};
}
type ResolvedSession =
	| { type: "path"; path: string }
	| { type: "local"; path: string }
	| { type: "global"; path: string; cwd: string }
	| { type: "not_found"; arg: string };
async function resolveSessionPath(sessionArg: string, cwd: string, sessionDir?: string): Promise<ResolvedSession> {
	if (sessionArg.includes("/") || sessionArg.includes("\\") || sessionArg.endsWith(".jsonl")) {
		return { type: "path", path: sessionArg };
	}
	const localSessions = await SessionManager.list(cwd, sessionDir);
	const localMatches = localSessions.filter((s) => s.id.startsWith(sessionArg));
	if (localMatches.length >= 1) {
		return { type: "local", path: localMatches[0].path };
	}
	const allSessions = await SessionManager.listAll();
	const globalMatches = allSessions.filter((s) => s.id.startsWith(sessionArg));
	if (globalMatches.length >= 1) {
		const match = globalMatches[0];
		return { type: "global", path: match.path, cwd: match.cwd };
	}
	return { type: "not_found", arg: sessionArg };
}
async function promptConfirm(message: string): Promise<boolean> {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(`${message} [y/N] `, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
		});
	});
}
async function callSessionDirectoryHook(extensions: LoadExtensionsResult, cwd: string): Promise<string | undefined> {
	let customSessionDir: string | undefined;
	for (const ext of extensions.extensions) {
		const handlers = ext.handlers.get("session_directory");
		if (!handlers || handlers.length === 0) continue;
		for (const handler of handlers) {
			try {
				const event = { type: "session_directory" as const, cwd };
				const result = (await handler(event)) as { sessionDir?: string } | undefined;
				if (result?.sessionDir) {
					customSessionDir = result.sessionDir;
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(chalk.red(`Extension "${ext.path}" session_directory handler failed: ${message}`));
			}
		}
	}
	return customSessionDir;
}
async function createSessionManager(
	parsed: Args,
	cwd: string,
	extensions: LoadExtensionsResult,
): Promise<SessionManager | undefined> {
	if (parsed.noSession) {
		return SessionManager.inMemory();
	}
	let effectiveSessionDir = parsed.sessionDir;
	if (!effectiveSessionDir) {
		effectiveSessionDir = await callSessionDirectoryHook(extensions, cwd);
	}
	if (parsed.session) {
		const resolved = await resolveSessionPath(parsed.session, cwd, effectiveSessionDir);
		switch (resolved.type) {
			case "path":
			case "local":
				return SessionManager.open(resolved.path, effectiveSessionDir);
			case "global": {
				console.log(chalk.yellow(`Session found in different project: ${resolved.cwd}`));
				const shouldFork = await promptConfirm("Fork this session into current directory?");
				if (!shouldFork) {
					console.log(chalk.dim("Aborted."));
					process.exit(0);
				}
				return SessionManager.forkFrom(resolved.path, cwd, effectiveSessionDir);
			}
			case "not_found":
				console.error(chalk.red(`No session found matching '${resolved.arg}'`));
				process.exit(1);
		}
	}
	if (parsed.continue) {
		return SessionManager.continueRecent(cwd, effectiveSessionDir);
	}
	if (effectiveSessionDir) {
		return SessionManager.create(cwd, effectiveSessionDir);
	}
	return undefined;
}
function buildSessionOptions(
	parsed: Args,
	sessionManager: SessionManager | undefined,
	modelRegistry: ModelRegistry,
	settingsManager: SettingsManager,
): { options: CreateAgentSessionOptions; cliThinkingFromModel: boolean } {
	const options: CreateAgentSessionOptions = {};
	const cliThinkingFromModel = false;
	if (sessionManager) {
		options.sessionManager = sessionManager;
	}
	if (parsed.thinking) {
		options.thinkingLevel = parsed.thinking;
	}
	if (parsed.noTools) {
		if (parsed.tools && parsed.tools.length > 0) {
			options.tools = parsed.tools.map((name) => allTools[name]);
		} else {
			options.tools = [];
		}
	} else if (parsed.tools) {
		options.tools = parsed.tools.map((name) => allTools[name]);
	}
	return { options, cliThinkingFromModel };
}
async function handleConfigCommand(args: string[]): Promise<boolean> {
	if (args[0] !== "config") {
		return false;
	}
	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	reportSettingsErrors(settingsManager, "config command");
	const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
	const resolvedPaths = await packageManager.resolve();
	await selectConfig({
		resolvedPaths,
		settingsManager,
		cwd,
		agentDir,
	});
	process.exit(0);
}
async function processFilesInParallel(
	fileArgs: string[],
	autoResizeImages: boolean,
): Promise<{ text: string; images: ImageContent[] }> {
	const chunkSize = globalMultiGPUExecutor ? Math.ceil(fileArgs.length / 4) : fileArgs.length;
	const chunks: string[][] = [];
	for (let i = 0; i < fileArgs.length; i += chunkSize) {
		chunks.push(fileArgs.slice(i, i + chunkSize));
	}
	const results = await Promise.all(chunks.map((chunk) => processFileArguments(chunk, { autoResizeImages })));
	const text = results.map((r) => r.text).join("");
	const images = results.flatMap((r) => r.images);
	return { text, images };
}
export async function main(args: string[]) {
	debugLog("main", "Starting main", { args, pid: process.pid, platform: process.platform });
	try {
		const offlineMode = args.includes("--offline") || isTruthyEnvFlag(process.env.PI_OFFLINE);
		if (offlineMode) {
			process.env.PI_OFFLINE = "1";
			process.env.PI_SKIP_VERSION_CHECK = "1";
		}
		if (await handlePackageCommand(args)) {
			return;
		}
		if (await handleConfigCommand(args)) {
			return;
		}
		debugLog("main", "Running migrations");
		const { deprecationWarnings } = runMigrations(process.cwd());
		debugLog("main", "Parsing args");
		const firstPass = parseArgs(args);
		debugLog("main", "Initializing components");
		const cwd = process.cwd();
		const agentDir = getAgentDir();
		const settingsManager = SettingsManager.create(cwd, agentDir);
		reportSettingsErrors(settingsManager, "startup");
		const authStorage = AuthStorage.create();
		const modelRegistry = new ModelRegistry(authStorage, getModelsPath());
		debugLog("main", "Creating resource loader");
		const resourceLoader = new DefaultResourceLoader({
			cwd,
			agentDir,
			settingsManager,
			additionalExtensionPaths: firstPass.extensions,
			additionalSkillPaths: firstPass.skills,
			additionalPromptTemplatePaths: firstPass.promptTemplates,
			additionalThemePaths: firstPass.themes,
			noExtensions: firstPass.noExtensions,
			noSkills: firstPass.noSkills,
			noPromptTemplates: firstPass.noPromptTemplates,
			noThemes: firstPass.noThemes,
			systemPrompt: firstPass.systemPrompt,
			appendSystemPrompt: firstPass.appendSystemPrompt,
		});
		debugLog("main", "Reloading resources");
		await resourceLoader.reload();
		time("resourceLoader.reload");
		debugLog("main", "Loading extensions");
		const extensionsResult: LoadExtensionsResult = resourceLoader.getExtensions();
		for (const { path, error } of extensionsResult.errors) {
			console.error(chalk.red(`Failed to load extension "${path}": ${error}`));
		}
		// Provider registration removed - models are configured during onboarding only
		const extensionFlags = new Map<string, { type: "boolean" | "string" }>();
		for (const ext of extensionsResult.extensions) {
			for (const [name, flag] of ext.flags) {
				extensionFlags.set(name, { type: flag.type });
			}
		}
		const parsed = parseArgs(args, extensionFlags);
		for (const [name, value] of parsed.unknownFlags) {
			extensionsResult.runtime.flagValues.set(name, value);
		}
		if (parsed.version) {
			console.log(VERSION);
			process.exit(0);
		}
		if (parsed.help) {
			printHelp();
			process.exit(0);
		}
		if (parsed.listModels !== undefined) {
			const searchPattern = typeof parsed.listModels === "string" ? parsed.listModels : undefined;
			await listModels(modelRegistry, searchPattern);
			process.exit(0);
		}
		if (parsed.mode !== "rpc") {
			const stdinContent = await readPipedStdin();
			if (stdinContent !== undefined) {
				parsed.print = true;
				parsed.messages.unshift(stdinContent);
			}
		}
		if (parsed.export) {
			let result: string;
			try {
				const outputPath = parsed.messages.length > 0 ? parsed.messages[0] : undefined;
				result = await exportFromFile(parsed.export, outputPath);
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : "Failed to export session";
				console.error(chalk.red(`Error: ${message}`));
				process.exit(1);
			}
			console.log(`Exported to: ${result}`);
			process.exit(0);
		}
		if (parsed.mode === "rpc" && parsed.fileArgs.length > 0) {
			console.error(chalk.red("Error: @file arguments are not supported in RPC mode"));
			process.exit(1);
		}
		let initialMessage: string | undefined;
		let initialImages: ImageContent[] | undefined;
		if (parsed.fileArgs.length > 0 && parsed.fileArgs.length > 4) {
			const result = await processFilesInParallel(parsed.fileArgs, settingsManager.getImageAutoResize());
			initialMessage = result.text;
			initialImages = result.images.length > 0 ? result.images : undefined;
			if (parsed.messages.length > 0) {
				initialMessage = initialMessage + parsed.messages[0];
				parsed.messages.shift();
			}
		} else {
			const result = await prepareInitialMessage(parsed, settingsManager.getImageAutoResize());
			initialMessage = result.initialMessage;
			initialImages = result.initialImages;
		}
		const isInteractive = !parsed.print && parsed.mode === undefined;
		const mode = parsed.mode || "text";
		initTheme(settingsManager.getTheme(), isInteractive);
		if (isInteractive && deprecationWarnings.length > 0) {
			await showDeprecationWarnings(deprecationWarnings);
		}
		let sessionManager = await createSessionManager(parsed, cwd, extensionsResult);
		if (parsed.resume) {
			KeybindingsManager.create();
			const effectiveSessionDir = parsed.sessionDir || (await callSessionDirectoryHook(extensionsResult, cwd));
			const selectedPath = await selectSession(
				(onProgress) => SessionManager.list(cwd, effectiveSessionDir, onProgress),
				SessionManager.listAll,
			);
			if (!selectedPath) {
				console.log(chalk.dim("No session selected"));
				stopThemeWatcher();
				process.exit(0);
			}
			sessionManager = SessionManager.open(selectedPath, effectiveSessionDir);
		}
		const { options: sessionOptions, cliThinkingFromModel } = buildSessionOptions(
			parsed,
			sessionManager,
			modelRegistry,
			settingsManager,
		);
		sessionOptions.authStorage = authStorage;
		sessionOptions.modelRegistry = modelRegistry;
		sessionOptions.resourceLoader = resourceLoader;
		if (parsed.apiKey) {
			console.error(chalk.red("--api-key is deprecated. Please configure your API key during onboarding."));
			process.exit(1);
		}
		const { session, modelFallbackMessage } = await createAgentSession(sessionOptions);
		if (!isInteractive && !session.model) {
			console.error(chalk.red("No model configured."));
			console.error(chalk.yellow("\nPlease run onboarding to configure your model:"));
			console.error("  openvibe --onboarding");
			process.exit(1);
		}
		const cliThinkingOverride = parsed.thinking !== undefined || cliThinkingFromModel;
		if (session.model && cliThinkingOverride) {
			let effectiveThinking = session.thinkingLevel;
			if (!session.model.reasoning) {
				effectiveThinking = "off";
			} else if (effectiveThinking === "xhigh" && !supportsXhigh(session.model)) {
				effectiveThinking = "high";
			}
			if (effectiveThinking !== session.thinkingLevel) {
				session.setThinkingLevel(effectiveThinking);
			}
		}
		debugLog("main", "Selecting run mode", { mode, isInteractive });
		if (mode === "rpc") {
			debugLog("main", "Running RPC mode");
			await runRpcMode(session);
		} else if (isInteractive) {
			debugLog("main", "Running interactive mode");
			printTimings();
			const mode = new InteractiveMode(session, {
				initialMessage,
				initialImages,
				initialMessages: parsed.messages,
				verbose: parsed.verbose,
			});
			await mode.run();
		} else {
			debugLog("main", "Running print mode");
			await runPrintMode(session, {
				mode,
				messages: parsed.messages,
				initialMessage,
				initialImages,
			});
			stopThemeWatcher();
			if (process.stdout.writableLength > 0) {
				await new Promise<void>((resolve) => process.stdout.once("drain", resolve));
			}
			process.exit(0);
		}
		debugLog("main", "Main completed successfully");
	} catch (error) {
		debugLog("main", "Main crashed", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		console.error(chalk.red("\n[CRASH] Application crashed:"));
		console.error(error);
		fs.appendFileSync(
			"crash.log",
			`[${new Date().toISOString()}] Main Crash:\n${error instanceof Error ? error.stack : String(error)}\n\n`,
		);
		process.exit(1);
	}
}
