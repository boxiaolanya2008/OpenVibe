/**
 * Context Provider Registry
 * Central registry for managing context providers in the third-party architecture
 */

import type { Api, Model } from "@mariozechner/pi-ai";
import type {
	IContextEnhancement,
	IContextProvider,
	IContextProviderRegistry,
	IModelContextConfig,
} from "./context-provider-interface.js";
import { getLargeContextProvider, LargeContextProvider } from "./large-context-provider.js";

/**
 * Context Provider Registry Implementation
 * Manages multiple context providers and routes requests to the appropriate one
 */
export class ContextProviderRegistry implements IContextProviderRegistry {
	private providers: Map<string, IContextProvider> = new Map();
	private defaultProvider: IContextProvider;
	private static instance: ContextProviderRegistry | null = null;

	private constructor() {
		// Register the large context provider as default
		this.defaultProvider = getLargeContextProvider();
		this.register(this.defaultProvider);
	}

	/**
	 * Get the singleton instance
	 */
	static getInstance(): ContextProviderRegistry {
		if (!ContextProviderRegistry.instance) {
			ContextProviderRegistry.instance = new ContextProviderRegistry();
		}
		return ContextProviderRegistry.instance;
	}

	/**
	 * Register a context provider
	 */
	register(provider: IContextProvider): void {
		this.providers.set(provider.name, provider);
	}

	/**
	 * Unregister a context provider
	 */
	unregister(name: string): void {
		if (name === this.defaultProvider.name) {
			console.warn(`Cannot unregister default provider: ${name}`);
			return;
		}
		this.providers.delete(name);
	}

	/**
	 * Get a provider by name
	 */
	get(name: string): IContextProvider | undefined {
		return this.providers.get(name);
	}

	/**
	 * Get all registered providers
	 */
	getAll(): IContextProvider[] {
		return Array.from(this.providers.values());
	}

	/**
	 * Find the best provider for a model
	 */
	findProvider(modelId: string): IContextProvider | undefined {
		// Check all providers for explicit support
		const providers = Array.from(this.providers.values());
		for (const provider of providers) {
			if (provider.supportsModel(modelId)) {
				return provider;
			}
		}

		// Fall back to default provider
		return this.defaultProvider;
	}

	/**
	 * Get context configuration from any provider
	 */
	getContextConfig(modelId: string): IModelContextConfig {
		const provider = this.findProvider(modelId);
		if (provider) {
			return provider.getContextConfig(modelId);
		}

		// Default 1M context configuration
		return {
			contextWindow: 1000000,
			maxTokens: 65536,
			supportsStreaming: true,
			supportsVision: true,
			supportsFunctions: true,
		};
	}

	/**
	 * Enhance a model with context configuration
	 * This is the main entry point for the third-party architecture
	 */
	enhanceModel<API extends Api>(model: Model<API>): IContextEnhancement<API> {
		const provider = this.findProvider(model.id);
		const config = this.getContextConfig(model.id);

		const originalContextWindow = model.contextWindow ?? 0;
		const enhancedContextWindow = config.contextWindow;

		const enhancedModel: Model<API> = {
			...model,
			contextWindow: enhancedContextWindow,
			maxTokens: config.maxTokens,
		};

		return {
			model: enhancedModel,
			provider: provider ?? this.defaultProvider,
			metadata: {
				originalContextWindow,
				enhancedContextWindow,
				enhanced: originalContextWindow !== enhancedContextWindow,
			},
		};
	}

	/**
	 * Check if a model has large context support
	 */
	hasLargeContext(modelId: string): boolean {
		const config = this.getContextConfig(modelId);
		return config.contextWindow >= 100000;
	}

	/**
	 * Check if a model has 1M context
	 */
	hasMillionContext(modelId: string): boolean {
		const config = this.getContextConfig(modelId);
		return config.contextWindow >= 1000000;
	}

	/**
	 * Get all models with 1M context
	 */
	getMillionContextModels(): string[] {
		const models: string[] = [];
		const providers = Array.from(this.providers.values());

		for (const provider of providers) {
			if (provider instanceof LargeContextProvider) {
				models.push(...provider.getKnownModels().filter((id) => provider.isMillionContextModel(id)));
			}
		}

		return Array.from(new Set(models));
	}
}

/**
 * Singleton getter
 */
export const getContextProviderRegistry = () => ContextProviderRegistry.getInstance();

/**
 * Convenience function to enhance a model with context configuration
 */
export function enhanceModelContext<API extends Api>(model: Model<API>): Model<API> {
	const registry = ContextProviderRegistry.getInstance();
	const enhancement = registry.enhanceModel(model);
	return enhancement.model;
}

/**
 * Convenience function to get context configuration for a model
 */
export function getModelContextConfig(modelId: string): IModelContextConfig {
	const registry = ContextProviderRegistry.getInstance();
	return registry.getContextConfig(modelId);
}

/**
 * Initialize the context provider registry
 */
export function initializeContextProviders(): ContextProviderRegistry {
	return ContextProviderRegistry.getInstance();
}
