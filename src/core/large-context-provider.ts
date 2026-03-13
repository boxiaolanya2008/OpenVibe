/**
 * Large Context Provider Implementation
 * Provides 1M context window support for compatible models
 * This is a third-party architecture implementation
 */

import type { Api, Model } from "@mariozechner/pi-ai";
import type {
	IContextProvider,
	IModelContextConfig,
	IOverflowResult,
	IProcessedContext,
} from "./context-provider-interface.js";

/**
 * Model capability flags
 */
interface ModelCapabilities {
	supportsStreaming: boolean;
	supportsVision: boolean;
	supportsFunctions: boolean;
}

/**
 * Large context model definitions
 */
export const LARGE_CONTEXT_DEFINITIONS: Record<
	string,
	{
		contextWindow: number;
		maxTokens: number;
		capabilities: ModelCapabilities;
	}
> = {
	// ═══════════════════════════════════════════════════════════════
	// Google Gemini - 1M Context
	// ═══════════════════════════════════════════════════════════════
	"gemini-1.5-pro": {
		contextWindow: 1000000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"gemini-1.5-flash": {
		contextWindow: 1000000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"gemini-2.0-flash": {
		contextWindow: 1000000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"gemini-2.0-pro": {
		contextWindow: 1000000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// Anthropic Claude - 200K Context
	// ═══════════════════════════════════════════════════════════════
	"claude-3-opus-20240229": {
		contextWindow: 200000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"claude-3-sonnet-20240229": {
		contextWindow: 200000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"claude-3-haiku-20240307": {
		contextWindow: 200000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"claude-3-5-sonnet-20241022": {
		contextWindow: 200000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"claude-3-5-haiku-20241022": {
		contextWindow: 200000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"claude-sonnet-4-20250514": {
		contextWindow: 200000,
		maxTokens: 16384,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// OpenAI - 128K Context
	// ═══════════════════════════════════════════════════════════════
	"gpt-4-turbo": {
		contextWindow: 128000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"gpt-4-turbo-preview": {
		contextWindow: 128000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"gpt-4o": {
		contextWindow: 128000,
		maxTokens: 16384,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"gpt-4o-mini": {
		contextWindow: 128000,
		maxTokens: 16384,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"gpt-4-0125-preview": {
		contextWindow: 128000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// DeepSeek - 64K Context
	// ═══════════════════════════════════════════════════════════════
	"deepseek-chat": {
		contextWindow: 64000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"deepseek-coder": {
		contextWindow: 64000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"deepseek-reasoner": {
		contextWindow: 64000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// Alibaba Qwen - Up to 1M Context
	// ═══════════════════════════════════════════════════════════════
	"qwen-2.5-72b-instruct": {
		contextWindow: 131072,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"qwen-2.5-32b-instruct": {
		contextWindow: 131072,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"qwen-max": {
		contextWindow: 1000000,
		maxTokens: 65536,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"qwen-max-longcontext": {
		contextWindow: 1000000,
		maxTokens: 65536,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// Moonshot Kimi - Up to 128K Context
	// ═══════════════════════════════════════════════════════════════
	"moonshot-v1-8k": {
		contextWindow: 8192,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"moonshot-v1-32k": {
		contextWindow: 32768,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"moonshot-v1-128k": {
		contextWindow: 131072,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// Meta Llama 3.1 - 128K Context
	// ═══════════════════════════════════════════════════════════════
	"llama-3.1-405b-instruct": {
		contextWindow: 128000,
		maxTokens: 16384,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"llama-3.1-70b-instruct": {
		contextWindow: 128000,
		maxTokens: 16384,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"llama-3.1-8b-instruct": {
		contextWindow: 128000,
		maxTokens: 16384,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// Mistral - Up to 128K Context
	// ═══════════════════════════════════════════════════════════════
	"mistral-large-2407": {
		contextWindow: 128000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"mistral-large-2402": {
		contextWindow: 32000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// 01.AI Yi - Up to 32K Context
	// ═══════════════════════════════════════════════════════════════
	"yi-lightning": {
		contextWindow: 16384,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"yi-large": {
		contextWindow: 32768,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// Zhipu GLM - 128K Context
	// ═══════════════════════════════════════════════════════════════
	"glm-4": {
		contextWindow: 128000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},
	"glm-4-plus": {
		contextWindow: 128000,
		maxTokens: 4096,
		capabilities: { supportsStreaming: true, supportsVision: true, supportsFunctions: true },
	},

	// ═══════════════════════════════════════════════════════════════
	// Groq Models - Varies
	// ═══════════════════════════════════════════════════════════════
	"llama-3.3-70b-versatile": {
		contextWindow: 128000,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: true },
	},
	"llama-3.3-70b-specdec": {
		contextWindow: 8192,
		maxTokens: 8192,
		capabilities: { supportsStreaming: true, supportsVision: false, supportsFunctions: false },
	},
};

/**
 * Large Context Provider
 * Implements the IContextProvider interface for 1M context support
 */
export class LargeContextProvider implements IContextProvider {
	readonly name = "large-context";
	readonly version = "1.0.0";

	private customModels: Map<string, { contextWindow: number; maxTokens: number; capabilities: ModelCapabilities }> =
		new Map();

	/**
	 * Check if this provider supports a given model
	 */
	supportsModel(modelId: string): boolean {
		const normalized = this.normalizeModelId(modelId);
		return normalized in LARGE_CONTEXT_DEFINITIONS || this.customModels.has(normalized);
	}

	/**
	 * Get context window for a model
	 */
	getContextWindow(modelId: string): number {
		return this.getContextConfig(modelId).contextWindow;
	}

	/**
	 * Get max output tokens for a model
	 */
	getMaxTokens(modelId: string): number {
		return this.getContextConfig(modelId).maxTokens;
	}

	/**
	 * Get full context configuration for a model
	 */
	getContextConfig(modelId: string): IModelContextConfig {
		const normalized = this.normalizeModelId(modelId);

		// Check custom models first
		const custom = this.customModels.get(normalized);
		if (custom) {
			return {
				contextWindow: custom.contextWindow,
				maxTokens: custom.maxTokens,
				supportsStreaming: custom.capabilities.supportsStreaming,
				supportsVision: custom.capabilities.supportsVision,
				supportsFunctions: custom.capabilities.supportsFunctions,
			};
		}

		// Check known models
		const definition = LARGE_CONTEXT_DEFINITIONS[normalized];
		if (definition) {
			return {
				contextWindow: definition.contextWindow,
				maxTokens: definition.maxTokens,
				supportsStreaming: definition.capabilities.supportsStreaming,
				supportsVision: definition.capabilities.supportsVision,
				supportsFunctions: definition.capabilities.supportsFunctions,
			};
		}

		// Default: 1M context for unknown models
		return {
			contextWindow: 1000000,
			maxTokens: 65536,
			supportsStreaming: true,
			supportsVision: true,
			supportsFunctions: true,
		};
	}

	/**
	 * Process messages before sending to API
	 */
	processMessages(messages: unknown[], modelId: string): IProcessedContext {
		const config = this.getContextConfig(modelId);
		const messageStr = JSON.stringify(messages);
		const estimatedTokens = Math.ceil(messageStr.length / 4);

		return {
			messages,
			tokenCount: estimatedTokens,
			modified: false,
			metadata: {
				truncated: estimatedTokens > config.contextWindow,
			},
		};
	}

	/**
	 * Handle context overflow
	 */
	handleOverflow(messages: unknown[], modelId: string, tokenCount: number): IOverflowResult {
		const config = this.getContextConfig(modelId);

		if (tokenCount <= config.contextWindow) {
			return { action: "truncate", messages };
		}

		// For large context models, try to keep as much as possible
		if (config.contextWindow >= 100000) {
			// For 1M context, we likely have enough space
			return {
				action: "truncate",
				messages,
				metadata: {
					originalTokens: tokenCount,
					contextWindow: config.contextWindow,
					keepRatio: config.contextWindow / tokenCount,
				},
			};
		}

		return {
			action: "summarize",
			metadata: {
				originalTokens: tokenCount,
				contextWindow: config.contextWindow,
			},
		};
	}

	/**
	 * Register a custom model with context configuration
	 */
	registerCustomModel(
		modelId: string,
		config: {
			contextWindow: number;
			maxTokens: number;
			supportsVision?: boolean;
			supportsFunctions?: boolean;
		},
	): void {
		const normalized = this.normalizeModelId(modelId);
		this.customModels.set(normalized, {
			contextWindow: config.contextWindow,
			maxTokens: config.maxTokens,
			capabilities: {
				supportsStreaming: true,
				supportsVision: config.supportsVision ?? true,
				supportsFunctions: config.supportsFunctions ?? true,
			},
		});
	}

	/**
	 * Enhance a model with large context configuration
	 */
	enhanceModel<API extends Api>(model: Model<API>): Model<API> {
		const config = this.getContextConfig(model.id);

		return {
			...model,
			contextWindow: config.contextWindow,
			maxTokens: config.maxTokens,
		};
	}

	/**
	 * Get all known large context models
	 */
	getKnownModels(): string[] {
		return Object.keys(LARGE_CONTEXT_DEFINITIONS);
	}

	/**
	 * Check if a model has 1M context
	 */
	isMillionContextModel(modelId: string): boolean {
		const config = this.getContextConfig(modelId);
		return config.contextWindow >= 1000000;
	}

	/**
	 * Normalize model ID for matching
	 */
	private normalizeModelId(modelId: string): string {
		return modelId.toLowerCase().trim();
	}
}

/**
 * Singleton instance
 */
let largeContextProviderInstance: LargeContextProvider | null = null;

/**
 * Get the singleton instance
 */
export function getLargeContextProvider(): LargeContextProvider {
	if (!largeContextProviderInstance) {
		largeContextProviderInstance = new LargeContextProvider();
	}
	return largeContextProviderInstance;
}
