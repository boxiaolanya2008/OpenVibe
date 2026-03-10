import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { isValidThinkingLevel } from "../cli/args.js";
import { DEFAULT_THINKING_LEVEL } from "./defaults.js";
import type { ModelRegistry } from "./model-registry.js";
import { loadUserConfig } from "./user-config.js";

export interface ScopedModel {
	model: Model<Api>;
	thinkingLevel?: ThinkingLevel;
}

export class ModelResolver {
	private thinkingLevel: ThinkingLevel = DEFAULT_THINKING_LEVEL;

	constructor(
		private registry: ModelRegistry,
		private requestedModelId?: string,
		private requestedThinkingLevel?: string,
	) {
		this.resolveThinkingLevel();
	}

	private resolveThinkingLevel(): void {
		if (this.requestedThinkingLevel && isValidThinkingLevel(this.requestedThinkingLevel)) {
			this.thinkingLevel = this.requestedThinkingLevel;
		} else {
			this.thinkingLevel = DEFAULT_THINKING_LEVEL;
		}
	}

	resolveModel(): ScopedModel | null {
		const model = this.registry.getModel();
		if (!model) {
			return null;
		}
		return {
			model,
			thinkingLevel: this.thinkingLevel,
		};
	}

	getThinkingLevel(): ThinkingLevel {
		return this.thinkingLevel;
	}

	setThinkingLevel(level: ThinkingLevel): void {
		this.thinkingLevel = level;
	}

	getModelDisplayName(): string {
		const config = loadUserConfig();
		if (config.model) {
			return config.model.name || config.model.id;
		}
		return "Unknown Model";
	}
}
