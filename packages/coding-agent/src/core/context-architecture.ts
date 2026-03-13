/**
 * Context Architecture - Third-party implementation for large context support
 * Provides 1M context window support through an independent architecture
 *
 * @module context-architecture
 */

// Context Manager (alternative API)
export {
	type ContextConfig,
	ContextManager,
	ContextMiddleware,
	type ContextStats,
	type GlobalContextConfig,
	getContextManager,
	initializeContextManager,
	LARGE_CONTEXT_MODELS,
	type ProviderContextConfig,
} from "./context-manager.js";
// Core interfaces
export type {
	IContextEnhancement,
	IContextProvider,
	IContextProviderRegistry,
	IModelContextConfig,
	IOverflowResult,
	IProcessedContext,
} from "./context-provider-interface.js";
// Registry
export {
	ContextProviderRegistry,
	enhanceModelContext,
	getContextProviderRegistry,
	getModelContextConfig,
	initializeContextProviders,
} from "./context-provider-registry.js";
// Main implementation
export { getLargeContextProvider, LARGE_CONTEXT_DEFINITIONS, LargeContextProvider } from "./large-context-provider.js";
