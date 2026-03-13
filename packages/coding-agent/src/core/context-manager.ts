/**
 * Context Manager - Independent Architecture for Large Context Support
 * Provides 1M context window support through a third-party architecture
 * Works transparently with all models without modifying prompts
 */

import type { Api, Model } from "@mariozechner/pi-ai";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getAgentDir } from "../config.js";

/**
 * Context configuration for models
 */
export interface ContextConfig {
	/** Context window size in tokens */
	contextWindow: number;
	/** Maximum output tokens */
	maxTokens: number;
	/** Whether to enable chunking for large contexts */
	enableChunking?: boolean;
	/** Chunk size for processing (default: auto-calculated) */
	chunkSize?: number;
	/** Overlap between chunks (default: 2000 tokens) */
	chunkOverlap?: number;
	/** Enable context caching */
	enableCaching?: boolean;
	/** Cache TTL in seconds */
	cacheTTL?: number;
}

/**
 * Provider-level context configuration
 */
export interface ProviderContextConfig {
	/** Provider name */
	provider: string;
	/** Base URL override */
	baseUrl?: string;
	/** Default context for all models under this provider */
	defaultContext?: Partial<ContextConfig>;
	/** Per-model context overrides */
	models?: Record<string, ContextConfig>;
}

/**
 * Global context configuration
 */
export interface GlobalContextConfig {
	/** Enable large context support globally */
	enabled: boolean;
	/** Default context window (used when model doesn't specify) */
	defaultContextWindow: number;
	/** Default max output tokens */
	defaultMaxTokens: number;
	/** Provider configurations */
	providers: ProviderContextConfig[];
	/** Model-specific overrides */
	modelOverrides?: Record<string, ContextConfig>;
}

/**
 * Context stats for monitoring
 */
export interface ContextStats {
	/** Total context tokens used */
	tokensUsed: number;
	/** Context window size */
	contextWindow: number;
	/** Utilization percentage */
	utilization: number;
	/** Number of chunks processed */
	chunksProcessed?: number;
	/** Cache hit rate */
	cacheHitRate?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: GlobalContextConfig = {
	enabled: true,
	defaultContextWindow: 1000000, // 1M tokens
	defaultMaxTokens: 65536,
	providers: [],
};

/**
 * Known large context models with their configurations
 */
export const LARGE_CONTEXT_MODELS: Record<string, ContextConfig> = {
	// OpenAI
	"gpt-4-turbo": { contextWindow: 128000, maxTokens: 4096 },
	"gpt-4-turbo-preview": { contextWindow: 128000, maxTokens: 4096 },
	"gpt-4o": { contextWindow: 128000, maxTokens: 16384 },
	"gpt-4o-mini": { contextWindow: 128000, maxTokens: 16384 },

	// Anthropic
	"claude-3-opus": { contextWindow: 200000, maxTokens: 4096 },
	"claude-3-sonnet": { contextWindow: 200000, maxTokens: 4096 },
	"claude-3-haiku": { contextWindow: 200000, maxTokens: 4096 },
	"claude-3-5-sonnet": { contextWindow: 200000, maxTokens: 8192 },
	"claude-3-5-haiku": { contextWindow: 200000, maxTokens: 8192 },
	"claude-sonnet-4": { contextWindow: 200000, maxTokens: 16384 },

	// Google
	"gemini-1.5-pro": { contextWindow: 1000000, maxTokens: 8192 },
	"gemini-1.5-flash": { contextWindow: 1000000, maxTokens: 8192 },
	"gemini-2.0-flash": { contextWindow: 1000000, maxTokens: 8192 },

	// DeepSeek
	"deepseek-chat": { contextWindow: 64000, maxTokens: 4096 },
	"deepseek-coder": { contextWindow: 64000, maxTokens: 4096 },
	"deepseek-reasoner": { contextWindow: 64000, maxTokens: 8192 },

	// Mistral
	"mistral-large": { contextWindow: 128000, maxTokens: 8192 },
	"mistral-medium": { contextWindow: 32000, maxTokens: 8192 },

	// Meta Llama
	"llama-3.1-405b": { contextWindow: 128000, maxTokens: 16384 },
	"llama-3.1-70b": { contextWindow: 128000, maxTokens: 16384 },
	"llama-3.1-8b": { contextWindow: 128000, maxTokens: 16384 },

	// Qwen
	"qwen-2.5-72b": { contextWindow: 131072, maxTokens: 8192 },
	"qwen-2.5-32b": { contextWindow: 131072, maxTokens: 8192 },
	"qwen-max": { contextWindow: 1000000, maxTokens: 65536 },

	// Moonshot (Kimi)
	"moonshot-v1-8k": { contextWindow: 8192, maxTokens: 4096 },
	"moonshot-v1-32k": { contextWindow: 32768, maxTokens: 4096 },
	"moonshot-v1-128k": { contextWindow: 131072, maxTokens: 4096 },

	// Yi
	"yi-lightning": { contextWindow: 16384, maxTokens: 4096 },
	"yi-large": { contextWindow: 32768, maxTokens: 4096 },
	"yi-large-turbo": { contextWindow: 16384, maxTokens: 4096 },

	// GLM
	"glm-4": { contextWindow: 128000, maxTokens: 4096 },
	"glm-4-plus": { contextWindow: 128000, maxTokens: 4096 },

	// Default large context for unknown models
	"default-large": { contextWindow: 1000000, maxTokens: 65536 },
};

/**
 * Context Manager
 * Manages context window configuration for all models
 */
export class ContextManager {
	private config: GlobalContextConfig;
	private configPath: string;
	private static instance: ContextManager | null = null;

	private constructor() {
		this.configPath = join(getAgentDir(), "context-config.json");
		this.config = this.loadConfig();
	}

	/**
	 * Get the singleton instance
	 */
	static getInstance(): ContextManager {
		if (!ContextManager.instance) {
			ContextManager.instance = new ContextManager();
		}
		return ContextManager.instance;
	}

	/**
	 * Load configuration from file
	 */
	private loadConfig(): GlobalContextConfig {
		try {
			if (existsSync(this.configPath)) {
				const content = readFileSync(this.configPath, "utf-8");
				const loaded = JSON.parse(content) as Partial<GlobalContextConfig>;
				return { ...DEFAULT_CONFIG, ...loaded };
			}
		} catch (error) {
			console.error("Failed to load context config:", error);
		}
		return { ...DEFAULT_CONFIG };
	}

	/**
	 * Save configuration to file
	 */
	saveConfig(): void {
		try {
			const agentDir = getAgentDir();
			if (!existsSync(agentDir)) {
				const { mkdirSync } = require("fs");
				mkdirSync(agentDir, { recursive: true });
			}
			writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
		} catch (error) {
			console.error("Failed to save context config:", error);
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): GlobalContextConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<GlobalContextConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveConfig();
	}

	/**
	 * Get context configuration for a model
	 */
	getContextForModel(modelId: string): ContextConfig {
		// Check model overrides first
		if (this.config.modelOverrides?.[modelId]) {
			return this.config.modelOverrides[modelId];
		}

		// Check known models
		const normalizedId = modelId.toLowerCase();
		for (const [pattern, config] of Object.entries(LARGE_CONTEXT_MODELS)) {
			if (normalizedId.includes(pattern.toLowerCase()) || pattern.toLowerCase().includes(normalizedId)) {
				return config;
			}
		}

		// Check provider defaults
		for (const provider of this.config.providers) {
			if (provider.models?.[modelId]) {
				return provider.models[modelId];
			}
		}

		// Return default large context
		return {
			contextWindow: this.config.defaultContextWindow,
			maxTokens: this.config.defaultMaxTokens,
		};
	}

	/**
	 * Set context configuration for a specific model
	 */
	setContextForModel(modelId: string, config: ContextConfig): void {
		if (!this.config.modelOverrides) {
			this.config.modelOverrides = {};
		}
		this.config.modelOverrides[modelId] = config;
		this.saveConfig();
	}

	/**
	 * Register a provider with context configuration
	 */
	registerProvider(providerConfig: ProviderContextConfig): void {
		const existingIndex = this.config.providers.findIndex((p) => p.provider === providerConfig.provider);
		if (existingIndex >= 0) {
			this.config.providers[existingIndex] = providerConfig;
		} else {
			this.config.providers.push(providerConfig);
		}
		this.saveConfig();
	}

	/**
	 * Enhance a model with context configuration
	 * This is the main entry point for the third-party architecture
	 */
	enhanceModel<API extends Api>(model: Model<API>): Model<API> {
		if (!this.config.enabled) {
			return model;
		}

		const contextConfig = this.getContextForModel(model.id);

		return {
			...model,
			contextWindow: contextConfig.contextWindow,
			maxTokens: contextConfig.maxTokens,
		};
	}

	/**
	 * Calculate optimal chunk size based on context window
	 */
	calculateChunkSize(contextWindow: number): number {
		// Aim for 10% of context window as chunk size
		// But cap at 32K tokens for efficiency
		const targetChunkSize = Math.floor(contextWindow * 0.1);
		return Math.min(targetChunkSize, 32768);
	}

	/**
	 * Get context stats
	 */
	getStats(tokensUsed: number, modelId: string): ContextStats {
		const config = this.getContextForModel(modelId);
		const utilization = (tokensUsed / config.contextWindow) * 100;

		return {
			tokensUsed,
			contextWindow: config.contextWindow,
			utilization: Math.min(utilization, 100),
		};
	}

	/**
	 * Check if model supports large context
	 */
	isLargeContextModel(modelId: string): boolean {
		const config = this.getContextForModel(modelId);
		return config.contextWindow >= 100000;
	}

	/**
	 * Get recommended settings for a model
	 */
	getRecommendedSettings(modelId: string): {
		contextWindow: number;
		maxTokens: number;
		chunkSize: number;
		enableChunking: boolean;
	} {
		const config = this.getContextForModel(modelId);
		const chunkSize = this.calculateChunkSize(config.contextWindow);

		return {
			contextWindow: config.contextWindow,
			maxTokens: config.maxTokens,
			chunkSize,
			enableChunking: config.enableChunking ?? config.contextWindow >= 200000,
		};
	}
}

/**
 * Context middleware for request interception
 */
export class ContextMiddleware {
	private manager: ContextManager;

	constructor() {
		this.manager = ContextManager.getInstance();
	}

	/**
	 * Process context before sending to API
	 */
	processContext(messages: unknown[], modelId: string): {
		messages: unknown[];
		truncated: boolean;
		originalTokens: number;
		contextWindow: number;
	} {
		const config = this.manager.getContextForModel(modelId);

		// Estimate token count (rough estimation: 1 token ≈ 4 characters)
		const messageStr = JSON.stringify(messages);
		const estimatedTokens = Math.ceil(messageStr.length / 4);

		// Check if truncation is needed
		const truncated = estimatedTokens > config.contextWindow;

		return {
			messages,
			truncated,
			originalTokens: estimatedTokens,
			contextWindow: config.contextWindow,
		};
	}
}

/**
 * Initialize the context manager with default configuration
 */
export function initializeContextManager(): ContextManager {
	const manager = ContextManager.getInstance();

	// Register default providers with large context support
	manager.registerProvider({
		provider: "google",
		defaultContext: {
			contextWindow: 1000000,
			maxTokens: 8192,
		},
	});

	manager.registerProvider({
		provider: "anthropic",
		defaultContext: {
			contextWindow: 200000,
			maxTokens: 16384,
		},
	});

	manager.registerProvider({
		provider: "openai",
		defaultContext: {
			contextWindow: 128000,
			maxTokens: 16384,
		},
	});

	manager.registerProvider({
		provider: "deepseek",
		defaultContext: {
			contextWindow: 64000,
			maxTokens: 8192,
		},
	});

	manager.registerProvider({
		provider: "qwen",
		defaultContext: {
			contextWindow: 131072,
			maxTokens: 8192,
		},
	});

	return manager;
}

// Export singleton getter
export const getContextManager = () => ContextManager.getInstance();
