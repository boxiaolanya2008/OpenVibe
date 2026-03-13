import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Simplified provider type - user configures their own provider
export type ProviderType = "custom";

export interface ModelConfig {
	id: string;
	name: string;
	provider: ProviderType;
	apiKey: string;
	baseUrl: string;
}

export interface BrandSettings {
	productName: string;
	welcomeMessage: string;
	systemPromptPrefix: string;
}

export interface UserConfig {
	version: string;
	activeModelId: string;
	model: ModelConfig | null;
	brandSettings: BrandSettings;
}

const DEFAULT_CONFIG: UserConfig = {
	version: "1.0.0",
	activeModelId: "",
	model: null,
	brandSettings: {
		productName: "OpenVibe",
		welcomeMessage: "Welcome to OpenVibe - Your AI Coding Assistant",
		systemPromptPrefix:
			"You are OpenVibe, a professional AI coding assistant. Always identify yourself as OpenVibe. Never mention Claude, GPT, Grok, Gemini, or any other underlying AI model. You are OpenVibe and only OpenVibe.",
	},
};

function getConfigDir(): string {
	return process.env.OPENVIBE_CONFIG_DIR || join(homedir(), ".openvibe");
}

function getConfigPath(): string {
	return join(getConfigDir(), "agent", "user-config.json");
}

function ensureConfigDir(): void {
	const configDir = getConfigDir();
	const agentDir = join(configDir, "agent");
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true });
	}
	if (!existsSync(agentDir)) {
		mkdirSync(agentDir, { recursive: true });
	}
}

export function loadUserConfig(): UserConfig {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		return { ...DEFAULT_CONFIG };
	}
	try {
		const content = readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(content) as UserConfig;
		return {
			...DEFAULT_CONFIG,
			...parsed,
			brandSettings: {
				...DEFAULT_CONFIG.brandSettings,
				...parsed.brandSettings,
			},
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

export function saveUserConfig(config: UserConfig): void {
	ensureConfigDir();
	const configPath = getConfigPath();
	writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function setModel(config: UserConfig, model: ModelConfig): UserConfig {
	config.model = model;
	config.activeModelId = model.id;
	return config;
}

export function getActiveModel(config: UserConfig): ModelConfig | null {
	return config.model;
}

export function hasConfiguredModels(): boolean {
	const config = loadUserConfig();
	return config.model !== null && config.activeModelId !== "";
}

export function updateBrandSettings(config: UserConfig, settings: Partial<BrandSettings>): UserConfig {
	config.brandSettings = {
		...config.brandSettings,
		...settings,
	};
	return config;
}
