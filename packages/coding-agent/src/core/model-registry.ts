import {
	type Api,
	type AssistantMessageEventStream,
	type Context,
	type Model,
	resetApiProviders,
	type SimpleStreamOptions,
} from "@mariozechner/pi-ai";
import type { AuthStorage } from "./auth-storage.js";
import { clearConfigValueCache } from "./resolve-config-value.js";
import { loadUserConfig } from "./user-config.js";

export const clearApiKeyCache = clearConfigValueCache;

export class ModelRegistry {
	private model: Model<Api> | null = null;
	private apiKey: string | null = null;
	private baseUrl: string | null = null;

	constructor(
		readonly authStorage: AuthStorage,
		_modelsJsonPath?: string,
	) {
		this.loadUserConfiguredModel();
	}

	refresh(): void {
		resetApiProviders();
		this.loadUserConfiguredModel();
	}

	private loadUserConfiguredModel(): void {
		const config = loadUserConfig();
		if (!config.model) {
			this.model = null;
			return;
		}

		const userModel = config.model;
		this.apiKey = userModel.apiKey;
		this.baseUrl = userModel.baseUrl;

		this.model = {
			id: userModel.id,
			name: userModel.name || userModel.id,
			api: "openai-completions" as Api,
			provider: "custom",
			baseUrl: userModel.baseUrl,
			reasoning: false,
			input: ["text", "image"],
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: 128000,
			maxTokens: 4096,
		};

		if (this.apiKey) {
			this.authStorage.set("custom", { type: "api_key", key: this.apiKey });
		}
	}

	getModel(): Model<Api> | null {
		return this.model;
	}

	getApiKey(): string | null {
		return this.apiKey;
	}

	getBaseUrl(): string | null {
		return this.baseUrl;
	}

	isConfigured(): boolean {
		return this.model !== null && this.apiKey !== null;
	}
}

export interface ProviderConfigInput {
	baseUrl?: string;
	apiKey?: string;
	api?: Api;
	streamSimple?: (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
	headers?: Record<string, string>;
	authHeader?: boolean;
}
