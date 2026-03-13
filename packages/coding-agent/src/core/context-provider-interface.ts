/**
 * Context Provider Interface
 * Defines the contract for context providers in the third-party architecture
 */

import type { Api, Model } from "@mariozechner/pi-ai";

/**
 * Context provider interface
 * Third-party implementations should implement this interface
 */
export interface IContextProvider {
	/** Provider name */
	readonly name: string;

	/** Provider version */
	readonly version: string;

	/**
	 * Check if this provider supports a given model
	 */
	supportsModel(modelId: string): boolean;

	/**
	 * Get context window for a model
	 */
	getContextWindow(modelId: string): number;

	/**
	 * Get max output tokens for a model
	 */
	getMaxTokens(modelId: string): number;

	/**
	 * Get full context configuration for a model
	 */
	getContextConfig(modelId: string): IModelContextConfig;

	/**
	 * Process messages before sending to API
	 * Returns processed messages and metadata
	 */
	processMessages?(messages: unknown[], modelId: string): IProcessedContext;

	/**
	 * Handle context overflow
	 * Called when context exceeds the window
	 */
	handleOverflow?(messages: unknown[], modelId: string, tokenCount: number): IOverflowResult;
}

/**
 * Model context configuration
 */
export interface IModelContextConfig {
	/** Context window size in tokens */
	contextWindow: number;

	/** Maximum output tokens */
	maxTokens: number;

	/** Supports streaming */
	supportsStreaming: boolean;

	/** Supports vision/image input */
	supportsVision: boolean;

	/** Supports function calling */
	supportsFunctions: boolean;

	/** Custom model-specific settings */
	customSettings?: Record<string, unknown>;
}

/**
 * Processed context result
 */
export interface IProcessedContext {
	/** Processed messages */
	messages: unknown[];

	/** Token count */
	tokenCount: number;

	/** Whether context was modified */
	modified: boolean;

	/** Processing metadata */
	metadata?: {
		chunksUsed?: number;
		cacheHits?: number;
		truncated?: boolean;
	};
}

/**
 * Overflow handling result
 */
export interface IOverflowResult {
	/** Action to take */
	action: "truncate" | "summarize" | "chunk" | "reject";

	/** Processed messages (if action is truncate/summarize/chunk) */
	messages?: unknown[];

	/** Error message (if action is reject) */
	error?: string;

	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Context provider registry
 * Manages multiple context providers
 */
export interface IContextProviderRegistry {
	/**
	 * Register a context provider
	 */
	register(provider: IContextProvider): void;

	/**
	 * Unregister a context provider
	 */
	unregister(name: string): void;

	/**
	 * Get a provider by name
	 */
	get(name: string): IContextProvider | undefined;

	/**
	 * Get all registered providers
	 */
	getAll(): IContextProvider[];

	/**
	 * Find the best provider for a model
	 */
	findProvider(modelId: string): IContextProvider | undefined;

	/**
	 * Get context configuration from any provider
	 */
	getContextConfig(modelId: string): IModelContextConfig;
}

/**
 * Context enhancement result
 */
export interface IContextEnhancement<API extends Api> {
	/** Enhanced model */
	model: Model<API>;

	/** Provider that enhanced the model */
	provider: IContextProvider;

	/** Enhancement metadata */
	metadata: {
		originalContextWindow: number;
		enhancedContextWindow: number;
		enhanced: boolean;
	};
}
