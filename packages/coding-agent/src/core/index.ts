export {
	AcceleratedAPIClient,
	globalAcceleratedClient,
} from "./accelerated-client.js";
export {
	AcceleratedStream,
	globalAcceleratedStream,
	globalStreamMerger,
	StreamMerger,
} from "./accelerated-stream.js";
export {
	AgentSession,
	type AgentSessionConfig,
	type AgentSessionEvent,
	type AgentSessionEventListener,
	type ModelCycleResult,
	type PromptOptions,
	type SessionStats,
} from "./agent-session.js";
export {
	type AgentMode,
	type AgentModeConfig,
	AGENT_MODES,
	getAllModes,
	getAgentModeConfig,
	getModePromptAddition,
	getModeThinkingLevel,
	getModeTools,
	getClaudeSkillsPath,
} from "./agent-modes.js";
export {
	APIParallelExecutor,
	type ConcurrencyStats,
	detectOptimalConcurrency,
	globalParallelExecutor,
} from "./api-concurrency.js";
export { type BashExecutorOptions, type BashResult, executeBash, executeBashWithOperations } from "./bash-executor.js";
export type { CompactionResult } from "./compaction/index.js";
export { createEventBus, type EventBus, type EventBusController } from "./event-bus.js";

// Context Architecture - Third-party large context support (1M tokens)
export {
	// Interfaces
	type IContextProvider,
	type IModelContextConfig,
	type IProcessedContext,
	type IOverflowResult,
	type IContextProviderRegistry,
	type IContextEnhancement,
	// Main implementation
	LargeContextProvider,
	getLargeContextProvider,
	// Registry
	ContextProviderRegistry,
	getContextProviderRegistry,
	enhanceModelContext,
	getModelContextConfig,
	initializeContextProviders,
	// Context Manager
	ContextManager,
	ContextMiddleware,
	getContextManager,
	initializeContextManager,
	type ContextConfig,
	type ProviderContextConfig,
	type GlobalContextConfig,
	type ContextStats,
} from "./context-architecture.js";

export {
	type AgentEndEvent,
	type AgentStartEvent,
	type AgentToolResult,
	type AgentToolUpdateCallback,
	type BeforeAgentStartEvent,
	type ContextEvent,
	discoverAndLoadExtensions,
	type ExecOptions,
	type ExecResult,
	type Extension,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	type ExtensionError,
	type ExtensionEvent,
	type ExtensionFactory,
	type ExtensionFlag,
	type ExtensionHandler,
	ExtensionRunner,
	type ExtensionShortcut,
	type ExtensionUIContext,
	type LoadExtensionsResult,
	type MessageRenderer,
	type RegisteredCommand,
	type SessionBeforeCompactEvent,
	type SessionBeforeForkEvent,
	type SessionBeforeSwitchEvent,
	type SessionBeforeTreeEvent,
	type SessionCompactEvent,
	type SessionForkEvent,
	type SessionShutdownEvent,
	type SessionStartEvent,
	type SessionSwitchEvent,
	type SessionTreeEvent,
	type ToolCallEvent,
	type ToolDefinition,
	type ToolRenderResultOptions,
	type ToolResultEvent,
	type TurnEndEvent,
	type TurnStartEvent,
	wrapToolsWithExtensions,
} from "./extensions/index.js";
export {
	detectCPUCores,
	detectGPUCount,
	globalMultiGPUExecutor,
	MultiGPUExecutor,
} from "./multi-gpu-executor.js";
export { hasConfiguredModels as checkOnboarding, runOnboarding } from "./onboarding.js";
export type { BrandSettings, ModelConfig, UserConfig } from "./user-config.js";
export {
	getActiveModel,
	hasConfiguredModels,
	loadUserConfig,
	saveUserConfig,
	setModel,
	updateBrandSettings,
} from "./user-config.js";
