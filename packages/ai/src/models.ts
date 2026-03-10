import type { Api, Model } from "./types.js";

const modelRegistry: Map<string, Map<string, Model<Api>>> = new Map();

export function getProviders(): string[] {
	return Array.from(modelRegistry.keys());
}

export function getModels(provider: string): Model<Api>[] {
	const models = modelRegistry.get(provider);
	return models ? Array.from(models.values()) : [];
}

export function getModel(provider: string, modelId: string): Model<Api> | undefined {
	const providerModels = modelRegistry.get(provider);
	return providerModels?.get(modelId);
}

export function registerModel(model: Model<Api>): void {
	if (!modelRegistry.has(model.provider)) {
		modelRegistry.set(model.provider, new Map());
	}
	modelRegistry.get(model.provider)!.set(model.id, model);
}

export function unregisterModels(provider: string): void {
	modelRegistry.delete(provider);
}

export function clearModels(): void {
	modelRegistry.clear();
}

export function calculateCost<TApi extends Api>(
	model: Model<TApi>,
	usage: { input: number; output: number; cacheRead: number; cacheWrite: number },
): { input: number; output: number; cacheRead: number; cacheWrite: number; total: number } {
	const cost = {
		input: (model.cost.input / 1000000) * usage.input,
		output: (model.cost.output / 1000000) * usage.output,
		cacheRead: (model.cost.cacheRead / 1000000) * usage.cacheRead,
		cacheWrite: (model.cost.cacheWrite / 1000000) * usage.cacheWrite,
		total: 0,
	};
	cost.total = cost.input + cost.output + cost.cacheRead + cost.cacheWrite;
	return cost;
}

export function supportsXhigh<TApi extends Api>(model: Model<TApi>): boolean {
	if (model.id.includes("gpt-5.2") || model.id.includes("gpt-5.3") || model.id.includes("gpt-5.4")) {
		return true;
	}
	if (model.api === "anthropic-messages") {
		return model.id.includes("opus-4-6") || model.id.includes("opus-4.6");
	}
	return false;
}

export function modelsAreEqual<TApi extends Api>(
	a: Model<TApi> | null | undefined,
	b: Model<TApi> | null | undefined,
): boolean {
	if (!a || !b) return false;
	return a.id === b.id && a.provider === b.provider;
}
