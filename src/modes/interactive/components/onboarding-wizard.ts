import type { Component } from "@mariozechner/pi-tui";
import { Container, Spacer, Text, type TUI } from "@mariozechner/pi-tui";
import {
	loadUserConfig,
	type ModelConfig,
	saveUserConfig,
	setModel,
	updateBrandSettings,
} from "../../../core/user-config.js";

type OnboardingStep = "welcome" | "api-url" | "api-key" | "model-id" | "brand" | "complete";

interface WizardState {
	step: OnboardingStep;
	apiUrl: string;
	apiKey: string;
	modelId: string;
	brandName: string;
	welcomeMessage: string;
}

export class OnboardingWizard {
	private container: Container;
	private state: WizardState;
	private onComplete: () => void;
	private onCancel: () => void;

	constructor(_tui: TUI, onComplete: () => void, onCancel: () => void) {
		this.onComplete = onComplete;
		this.onCancel = onCancel;
		this.state = {
			step: "welcome",
			apiUrl: "",
			apiKey: "",
			modelId: "",
			brandName: "OpenVibe",
			welcomeMessage: "Welcome to OpenVibe - Your AI Coding Assistant",
		};
		this.container = new Container();
		this.render();
	}

	getContainer(): Component {
		return this.container;
	}

	private render(): void {
		this.container.clear();
		this.renderHeader();
		switch (this.state.step) {
			case "welcome":
				this.renderWelcomeStep();
				break;
			case "api-url":
				this.renderApiUrlStep();
				break;
			case "api-key":
				this.renderApiKeyStep();
				break;
			case "model-id":
				this.renderModelIdStep();
				break;
			case "brand":
				this.renderBrandStep();
				break;
			case "complete":
				this.renderCompleteStep();
				break;
		}
		this.renderFooter();
	}

	private renderHeader(): void {
		const logo = `
   ____                   __     __
  / __ \\____  ___  ____  / /__  / /_
 / / / / __ \\/ _ \\/ __ \\/ / _ \\/ __/
/ /_/ / /_/ /  __/ / / / /  __/ /_
/_____/ .___/\\___/_/ /_/_/\\___/\\__/
     /_/
    `;
		this.container.addChild(new Text(logo, 1, 0));
		this.container.addChild(new Text("=".repeat(60), 1, 0));
		const steps: OnboardingStep[] = ["welcome", "api-url", "api-key", "model-id", "brand", "complete"];
		const currentIndex = steps.indexOf(this.state.step);
		const progress = steps
			.map((_step, index) => {
				if (index < currentIndex) return "✓";
				if (index === currentIndex) return "●";
				return "○";
			})
			.join(" → ");
		this.container.addChild(new Text(`  ${progress}`, 1, 0));
		this.container.addChild(new Text("=".repeat(60), 1, 0));
		this.container.addChild(new Spacer(1));
	}

	private renderWelcomeStep(): void {
		this.container.addChild(new Text("  Welcome to OpenVibe!", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(
			new Text("  OpenVibe is your AI coding assistant that works with your own API keys.", 1, 0),
		);
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  This quick setup will help you configure your AI model.", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Press Enter to continue or Esc to exit.", 1, 0));
	}

	private renderApiUrlStep(): void {
		this.container.addChild(new Text("  Step 1: Enter API Base URL", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Examples:", 1, 0));
		this.container.addChild(new Text("    • https://api.openai.com/v1", 1, 0));
		this.container.addChild(new Text("    • https://api.anthropic.com", 1, 0));
		this.container.addChild(new Text("    • http://localhost:11434/v1", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text(`  URL: ${this.state.apiUrl || "_"}`, 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Type the URL and press Enter to continue.", 1, 0));
	}

	private renderApiKeyStep(): void {
		this.container.addChild(new Text("  Step 2: Enter Your API Key", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Your API key is stored locally and never shared.", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text(`  API Key: ${"*".repeat(this.state.apiKey.length) || "_"}`, 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Type your API key and press Enter to continue.", 1, 0));
	}

	private renderModelIdStep(): void {
		this.container.addChild(new Text("  Step 3: Enter Model ID", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Examples:", 1, 0));
		this.container.addChild(new Text("    • gpt-4o", 1, 0));
		this.container.addChild(new Text("    • claude-3-5-sonnet-20241022", 1, 0));
		this.container.addChild(new Text("    • grok-2", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text(`  Model ID: ${this.state.modelId || "_"}`, 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Type the model ID and press Enter to continue.", 1, 0));
	}

	private renderBrandStep(): void {
		this.container.addChild(new Text("  Step 4: Customize (Optional)", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text(`  Product Name: ${this.state.brandName}`, 1, 0));
		this.container.addChild(new Text(`  Welcome Message: ${this.state.welcomeMessage}`, 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Press Enter to continue with defaults.", 1, 0));
	}

	private renderCompleteStep(): void {
		this.container.addChild(new Text("  Setup Complete!", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text(`  Model: ${this.state.modelId}`, 1, 0));
		this.container.addChild(new Text(`  API URL: ${this.state.apiUrl}`, 1, 0));
		this.container.addChild(new Text(`  Product: ${this.state.brandName}`, 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Your configuration has been saved.", 1, 0));
		this.container.addChild(new Spacer(1));
		this.container.addChild(new Text("  Press Enter to start using OpenVibe!", 1, 0));
	}

	private renderFooter(): void {
		this.container.addChild(new Spacer(2));
		this.container.addChild(new Text("-".repeat(60), 1, 0));
		this.container.addChild(new Text("  Navigation: Enter = Continue | Esc = Back/Cancel", 1, 0));
	}

	handleInput(key: string): void {
		switch (this.state.step) {
			case "welcome":
				if (key === "\r" || key === "\n") {
					this.state.step = "api-url";
					this.render();
				} else if (key === "\u001b") {
					this.onCancel();
				}
				break;
			case "api-url":
				if (key === "\r" || key === "\n") {
					if (this.state.apiUrl.trim()) {
						this.state.step = "api-key";
						this.render();
					}
				} else if (key === "\u001b") {
					this.state.step = "welcome";
					this.render();
				} else if (key === "\b" || key === "\x7f") {
					this.state.apiUrl = this.state.apiUrl.slice(0, -1);
					this.render();
				} else if (key.length === 1 && key.charCodeAt(0) >= 32) {
					this.state.apiUrl += key;
					this.render();
				}
				break;
			case "api-key":
				if (key === "\r" || key === "\n") {
					if (this.state.apiKey.trim()) {
						this.state.step = "model-id";
						this.render();
					}
				} else if (key === "\u001b") {
					this.state.step = "api-url";
					this.render();
				} else if (key === "\b" || key === "\x7f") {
					this.state.apiKey = this.state.apiKey.slice(0, -1);
					this.render();
				} else if (key.length === 1 && key.charCodeAt(0) >= 32) {
					this.state.apiKey += key;
					this.render();
				}
				break;
			case "model-id":
				if (key === "\r" || key === "\n") {
					if (this.state.modelId.trim()) {
						this.state.step = "brand";
						this.render();
					}
				} else if (key === "\u001b") {
					this.state.step = "api-key";
					this.render();
				} else if (key === "\b" || key === "\x7f") {
					this.state.modelId = this.state.modelId.slice(0, -1);
					this.render();
				} else if (key.length === 1 && key.charCodeAt(0) >= 32) {
					this.state.modelId += key;
					this.render();
				}
				break;
			case "brand":
				if (key === "\r" || key === "\n") {
					this.saveConfiguration();
					this.state.step = "complete";
					this.render();
				} else if (key === "\u001b") {
					this.state.step = "model-id";
					this.render();
				}
				break;
			case "complete":
				if (key === "\r" || key === "\n") {
					this.onComplete();
				}
				break;
		}
	}

	private saveConfiguration(): void {
		let config = loadUserConfig();

		const modelConfig: ModelConfig = {
			id: this.state.modelId.trim(),
			name: this.state.modelId.trim(),
			provider: "custom",
			apiKey: this.state.apiKey.trim(),
			baseUrl: this.state.apiUrl.trim(),
		};

		config = setModel(config, modelConfig);
		config = updateBrandSettings(config, {
			productName: this.state.brandName,
			welcomeMessage: this.state.welcomeMessage,
		});

		saveUserConfig(config);
	}
}
