import { i18n } from "@mariozechner/mini-lit";
import { Badge } from "@mariozechner/mini-lit/dist/Badge.js";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { DialogBase } from "@mariozechner/mini-lit/dist/DialogBase.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import { Label } from "@mariozechner/mini-lit/dist/Label.js";
import { Select } from "@mariozechner/mini-lit/dist/Select.js";
import type { Model } from "@mariozechner/pi-ai";
import { getModel, getProviders } from "@mariozechner/pi-ai";
import { html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { getAppStorage } from "../storage/app-storage.js";
import { applyProxyIfNeeded } from "../utils/proxy-utils.js";

interface OnboardingConfig {
	provider: string;
	apiUrl?: string;
	apiKey: string;
	modelId: string;
}

@customElement("onboarding-dialog")
export class OnboardingDialog extends DialogBase {
	@state() private step: "welcome" | "configure" | "model" | "complete" = "welcome";
	@state() private provider = "";
	@state() private apiUrl = "";
	@state() private apiKey = "";
	@state() private modelId = "";
	@state() private availableModels: Model<any>[] = [];
	@state() private testing = false;
	@state() private testError = "";
	@state() private testSuccess = false;

	private resolvePromise?: (success: boolean) => void;

	protected modalWidth = "min(560px, 90vw)";
	protected modalHeight = "auto";

	static async open(): Promise<boolean> {
		// Check if already configured
		const storage = getAppStorage();
		const hasConfig = await storage.settings.get<OnboardingConfig>("onboarding.config");
		if (hasConfig) return true;

		const dialog = new OnboardingDialog();
		document.body.appendChild(dialog);
		dialog.open();
		dialog.requestUpdate();

		return new Promise((resolve) => {
			dialog.resolvePromise = resolve;
		});
	}

	override close() {
		super.close();
		if (this.resolvePromise) {
			this.resolvePromise(false);
			this.resolvePromise = undefined;
		}
	}

	private async testAndSaveKey(): Promise<boolean> {
		if (!this.provider || !this.apiKey) return false;

		this.testing = true;
		this.testError = "";
		this.testSuccess = false;
		this.requestUpdate();

		try {
			// Get models for the selected provider
			const providerModels = this.availableModels.filter((m) => m.provider === this.provider);
			const testModelId = providerModels.length > 0 ? providerModels[0].id : "gpt-4o-mini";

			let model = getModel(this.provider as any, testModelId);
			if (!model) return false;

			// Apply proxy if needed
			const proxyEnabled = await getAppStorage().settings.get<boolean>("proxy.enabled");
			const proxyUrl = await getAppStorage().settings.get<string>("proxy.url");
			model = applyProxyIfNeeded(model, this.apiKey, proxyEnabled ? proxyUrl || undefined : undefined);

			// Store the key temporarily for model discovery
			await getAppStorage().providerKeys.set(this.provider, this.apiKey);

			// Fetch available models for this provider
			const { complete } = await import("@mariozechner/pi-ai");
			const result = await complete(
				model,
				{
					messages: [{ role: "user", content: "Say 'ok'", timestamp: Date.now() }],
				},
				{ apiKey: this.apiKey, maxTokens: 50 },
			);

			this.testSuccess = result.stopReason === "stop";
			return this.testSuccess;
		} catch (error) {
			console.error("API key test failed:", error);
			this.testError = error instanceof Error ? error.message : "Failed to validate API key";
			return false;
		} finally {
			this.testing = false;
			this.requestUpdate();
		}
	}

	private async saveConfiguration() {
		if (!this.provider || !this.apiKey || !this.modelId) {
			this.testError = "Please fill in all required fields";
			this.requestUpdate();
			return;
		}

		try {
			const storage = getAppStorage();

			// Save API key
			await storage.providerKeys.set(this.provider, this.apiKey);

			// Save custom API URL if provided
			if (this.apiUrl) {
				await storage.settings.set(`provider.${this.provider}.baseUrl`, this.apiUrl);
			}

			// Save selected model as default
			await storage.settings.set("onboarding.defaultModel", this.modelId);
			await storage.settings.set("onboarding.defaultProvider", this.provider);

			// Mark onboarding as complete
			await storage.settings.set("onboarding.config", {
				provider: this.provider,
				apiUrl: this.apiUrl || undefined,
				apiKey: this.apiKey,
				modelId: this.modelId,
			} as OnboardingConfig);

			if (this.resolvePromise) {
				this.resolvePromise(true);
				this.resolvePromise = undefined;
			}
			this.close();
		} catch (error) {
			console.error("Failed to save configuration:", error);
			this.testError = "Failed to save configuration";
			this.requestUpdate();
		}
	}

	private loadAvailableModels() {
		// Use hardcoded models for common providers
		const modelMap: Record<string, { id: string; name: string }[]> = {
			anthropic: [
				{ id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
				{ id: "claude-opus-4-20250514", name: "Claude Opus 4" },
				{ id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
			],
			openai: [
				{ id: "gpt-4o", name: "GPT-4o" },
				{ id: "gpt-4o-mini", name: "GPT-4o Mini" },
				{ id: "gpt-4.5-preview", name: "GPT-4.5 Preview" },
			],
			google: [
				{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
				{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
			],
			groq: [
				{ id: "meta-llama/llama-4-scout", name: "Llama 4 Scout" },
				{ id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
			],
			openrouter: [
				{ id: "anthropic/claude-opus-4", name: "Claude Opus 4" },
				{ id: "openai/gpt-4o", name: "GPT-4o" },
			],
			xai: [{ id: "grok-3-beta", name: "Grok 3" }],
			zai: [{ id: "glm-4.5-air", name: "GLM-4.5 Air" }],
		};

		const models = modelMap[this.provider] || [];
		this.availableModels = models.map(
			(m) =>
				({
					id: m.id,
					name: m.name,
					provider: this.provider,
				}) as Model<any>,
		);

		// Set default model if available
		if (models.length > 0 && !this.modelId) {
			this.modelId = models[0].id;
		}
	}

	private renderWelcomeStep(): TemplateResult {
		return html`
			<div class="flex flex-col items-center gap-6 p-4">
				<div class="text-center">
					<h2 class="text-2xl font-bold text-foreground mb-2">Welcome to OpenVibe</h2>
					<p class="text-muted-foreground">
						Let&apos;s get you set up with an AI model provider.
					</p>
				</div>
				<div class="flex flex-col gap-2 w-full max-w-sm">
					${Button({
						onClick: () => {
							this.step = "configure";
							this.requestUpdate();
						},
						variant: "default",
						children: i18n("Get Started"),
						size: "lg",
						className: "w-full",
					})}
				</div>
			</div>
		`;
	}

	private renderConfigureStep(): TemplateResult {
		const providers = getProviders();
		const providerOptions = providers.map((p) => ({
			value: p,
			label: p.charAt(0).toUpperCase() + p.slice(1),
		}));

		return html`
			<div class="flex flex-col gap-4 p-2">
				<div class="flex items-center gap-2 mb-2">
					<button
						class="text-muted-foreground hover:text-foreground transition-colors"
						@click=${() => {
							this.step = "welcome";
							this.requestUpdate();
						}}
					>
						← Back
					</button>
				</div>

				<h2 class="text-lg font-semibold text-foreground">Configure Provider</h2>

				<div class="flex flex-col gap-2">
					${Label({ htmlFor: "provider", children: i18n("Provider") })}
					${Select({
						value: this.provider,
						placeholder: i18n("Select a provider"),
						options: providerOptions,
						onChange: (value: string) => {
							this.provider = value;
							this.loadAvailableModels();
							this.requestUpdate();
						},
						width: "100%",
					})}
				</div>

				${
					this.provider
						? html`
							<div class="flex flex-col gap-2">
								${Label({ htmlFor: "api-url", children: i18n("API URL (Optional)") })}
								${Input({
									type: "text",

									value: this.apiUrl,
									placeholder: i18n("Leave empty for default"),
									onInput: (e: Event) => {
										this.apiUrl = (e.target as HTMLInputElement).value;
										this.requestUpdate();
									},
								})}
								<p class="text-xs text-muted-foreground">
									Only needed for custom endpoints or self-hosted providers.
								</p>
							</div>

							<div class="flex flex-col gap-2">
								${Label({ htmlFor: "api-key", children: i18n("API Key") })}
								${Input({
									type: "password",
									value: this.apiKey,
									placeholder: i18n("Enter your API key"),
									onInput: (e: Event) => {
										this.apiKey = (e.target as HTMLInputElement).value;
										this.testError = "";
										this.requestUpdate();
									},
								})}
							</div>
					  `
						: ""
				}

				${this.testError ? html`<div class="text-sm text-destructive">${this.testError}</div>` : ""}

				<div class="flex gap-2 pt-4">
					${Button({
						onClick: () => this.close(),
						variant: "ghost",
						children: i18n("Skip"),
					})}
					${Button({
						onClick: async () => {
							if (!this.provider || !this.apiKey) {
								this.testError = "Please select a provider and enter API key";
								this.requestUpdate();
								return;
							}
							const success = await this.testAndSaveKey();
							if (success) {
								this.step = "model";
								this.requestUpdate();
							}
						},
						variant: "default",
						disabled: this.testing || !this.provider || !this.apiKey,
						children: this.testing ? i18n("Testing...") : i18n("Continue"),
					})}
				</div>
			</div>
		`;
	}

	private renderModelStep(): TemplateResult {
		const modelOptions = this.availableModels.map((m) => ({
			value: m.id,
			label: m.name,
		}));

		return html`
			<div class="flex flex-col gap-4 p-2">
				<div class="flex items-center gap-2 mb-2">
					<button
						class="text-muted-foreground hover:text-foreground transition-colors"
						@click=${() => {
							this.step = "configure";
							this.requestUpdate();
						}}
					>
						← Back
					</button>
				</div>

				<h2 class="text-lg font-semibold text-foreground">Select Model</h2>

				<div class="flex items-center gap-2">
					${Badge({ children: this.provider, variant: "secondary" })}
					<span class="text-sm text-muted-foreground">Connected</span>
				</div>

				<div class="flex flex-col gap-2">
					${Label({ htmlFor: "model", children: i18n("Model") })}
					${Select({
						value: this.modelId,
						placeholder: i18n("Select a model"),
						options: modelOptions,
						onChange: (value: string) => {
							this.modelId = value;
							this.requestUpdate();
						},
						width: "100%",
					})}
				</div>

				<div class="flex gap-2 pt-4">
					${Button({
						onClick: () => this.close(),
						variant: "ghost",
						children: i18n("Cancel"),
					})}
					${Button({
						onClick: () => this.saveConfiguration(),
						variant: "default",
						disabled: !this.modelId,
						children: i18n("Save & Continue"),
					})}
				</div>
			</div>
		`;
	}

	protected override renderContent(): TemplateResult {
		let content: TemplateResult;

		switch (this.step) {
			case "welcome":
				content = this.renderWelcomeStep();
				break;
			case "configure":
				content = this.renderConfigureStep();
				break;
			case "model":
				content = this.renderModelStep();
				break;
			default:
				content = this.renderWelcomeStep();
		}

		return html`
			<div class="flex flex-col overflow-hidden">
				<div class="overflow-y-auto">${content}</div>
			</div>
		`;
	}
}
