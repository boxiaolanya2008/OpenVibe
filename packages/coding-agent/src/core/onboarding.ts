import { createInterface } from "readline";
import { loadUserConfig, type ModelConfig, saveUserConfig, type UserConfig } from "./user-config.js";

export function hasConfiguredModels(): boolean {
	const config = loadUserConfig();
	return config.model !== null && config.activeModelId !== "";
}

export async function runOnboarding(): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	const question = (prompt: string): Promise<string> => {
		return new Promise((resolve) => {
			rl.question(prompt, (answer) => {
				resolve(answer);
			});
		});
	};

	console.clear();
	console.log(`
   ____                   __     __
  / __ \\____  ___  ____  / /__  / /_
 / / / / __ \\/ _ \\/ __ \\/ / _ \\/ __/
/ /_/ / /_/ /  __/ / / / /  __/ /_
/_____/ .___/\\___/_/ /_/_/\\___/\\__/
     /_/
`);
	console.log("=".repeat(60));
	console.log("  Welcome to OpenVibe!");
	console.log("=".repeat(60));
	console.log();
	console.log("  Let's set up your AI model.");
	console.log();

	console.log("Step 1: Enter API Base URL");
	console.log("-".repeat(60));
	console.log("  Examples:");
	console.log("  • https://api.openai.com/v1");
	console.log("  • https://api.anthropic.com");
	console.log("  • https://api.x.ai/v1");
	console.log("  • http://localhost:11434/v1");
	console.log();

	let baseUrl = "";
	while (!baseUrl.trim()) {
		baseUrl = await question("API Base URL: ");
		if (!baseUrl.trim()) {
			console.log("  API URL is required. Please try again.");
		}
	}

	console.log();
	console.log("Step 2: Enter API Key");
	console.log("-".repeat(60));
	console.log("  Your API key will be stored locally.");
	console.log();

	let apiKey = "";
	while (!apiKey.trim()) {
		apiKey = await question("API Key: ");
		if (!apiKey.trim()) {
			console.log("  API key is required. Please try again.");
		}
	}

	console.log();
	console.log("Step 3: Enter Model ID");
	console.log("-".repeat(60));
	console.log("  Examples: gpt-4o, claude-3-5-sonnet-20241022, grok-3");
	console.log();

	let modelId = "";
	while (!modelId.trim()) {
		modelId = await question("Model ID: ");
		if (!modelId.trim()) {
			console.log("  Model ID is required. Please try again.");
		}
	}

	const modelConfig: ModelConfig = {
		id: modelId.trim(),
		name: modelId.trim(),
		provider: "custom",
		apiKey: apiKey.trim(),
		baseUrl: baseUrl.trim(),
	};

	const config: UserConfig = {
		version: "1.0.0",
		activeModelId: modelId.trim(),
		model: modelConfig,
		brandSettings: {
			productName: "OpenVibe",
			welcomeMessage: "Welcome to OpenVibe",
			systemPromptPrefix: "",
		},
	};

	saveUserConfig(config);

	console.log();
	console.log("=".repeat(60));
	console.log("  Setup Complete!");
	console.log("=".repeat(60));
	console.log();
	console.log(`  API URL: ${baseUrl}`);
	console.log(`  Model: ${modelId}`);
	console.log();
	console.log("  Your configuration has been saved.");
	console.log();
	console.log("  Press Enter to start OpenVibe...");
	console.log();

	await question("");
	rl.close();

	if (process.stdin.isPaused()) {
		process.stdin.resume();
	}
}
