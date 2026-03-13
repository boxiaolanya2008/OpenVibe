import type { ModelRegistry } from "../core/model-registry.js";
import { loadUserConfig } from "../core/user-config.js";

function formatTokenCount(count: number): string {
	if (count >= 1_000_000) {
		const millions = count / 1_000_000;
		return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
	}
	if (count >= 1_000) {
		const thousands = count / 1_000;
		return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1)}K`;
	}
	return count.toString();
}

export async function listModels(modelRegistry: ModelRegistry, _searchPattern?: string): Promise<void> {
	const config = loadUserConfig();
	const model = modelRegistry.getModel();

	if (!model || !config.model) {
		console.log("No model configured. Please run onboarding first.");
		return;
	}

	console.log("Configured Model:");
	console.log(`  ID:          ${model.id}`);
	console.log(`  Name:        ${model.name}`);
	console.log(`  Provider:    ${model.provider}`);
	console.log(`  Base URL:    ${config.model.baseUrl}`);
	console.log(`  Context:     ${formatTokenCount(model.contextWindow)}`);
	console.log(`  Max Output:  ${formatTokenCount(model.maxTokens)}`);
	console.log(`  Reasoning:   ${model.reasoning ? "yes" : "no"}`);
	console.log(`  Images:      ${model.input.includes("image") ? "yes" : "no"}`);
}
