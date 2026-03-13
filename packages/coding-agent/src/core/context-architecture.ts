/**
 * Context Architecture - Third-party implementation for large context support
 * Provides 1M context window support through an independent architecture
 *
 * @module context-architecture
 */

// Core interfaces
export type {
	IContextProvider,
	IModelContextConfig,
	IProcessedContext,
	IOverflowResult,
	IContextProviderRegistry,
	IContextEnhancement,
} from "./context-provider-interface.js";

// Main implementation
export { LargeContextProvider, getLargeContextProvider } from "./large-context-provider.js";
export { LARGE_CONTEXT_DEFINITIONS } from "./large-context-provider.js";

// Registry
export {
	ContextProviderRegistry,
	getContextProviderRegistry,
	enhanceModelContext,
	getModelContextConfig,
	initializeContextProviders,
} from "./context-provider-registry.js";

// Context Manager (alternative API)
export {
	ContextManager,
	ContextMiddleware,
	getContextManager,
	initializeContextManager,
	type ContextConfig,
	type ProviderContextConfig,
	type GlobalContextConfig,
	type ContextStats,
	LARGE_CONTEXT_MODELS,
} from "./context-manager.js";
