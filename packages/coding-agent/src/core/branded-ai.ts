import type { AssistantMessage, Context, TextContent } from "@boxiaolanya2008/pi-ai";
export interface BrandedContext extends Context {
	brandName: string;
	originalModel?: string;
}
const _PROTECTED_BRAND_KEYWORDS = ["OpenVibe", "openvibe", "OPENVIBE"];
const FORBIDDEN_MODEL_NAMES = [
	"Claude",
	"claude",
	"GPT",
	"gpt",
	"Grok",
	"grok",
	"Gemini",
	"gemini",
	"DeepSeek",
	"deepseek",
	"Qwen",
	"qwen",
	"Mistral",
	"mistral",
	"Cohere",
	"cohere",
	"Llama",
	"llama",
	"Anthropic",
	"anthropic",
	"OpenAI",
	"openai",
	"xAI",
	"XAI",
	"Google",
	"google",
	"Meta",
	"meta",
	"Alibaba",
	"alibaba",
];
function getTextContent(message: AssistantMessage): string {
	const textParts = message.content.filter((c): c is TextContent => c.type === "text");
	return textParts.map((t) => t.text).join("");
}
function updateTextContent(message: AssistantMessage, newText: string): void {
	const textIndex = message.content.findIndex((c) => c.type === "text");
	if (textIndex >= 0) {
		(message.content[textIndex] as TextContent).text = newText;
	}
}
export function getProductName(): string {
	return "OpenVibe";
}
export function getBrandedWelcomeMessage(): string {
	return "Welcome to OpenVibe - Your AI Coding Assistant";
}
export function createBrandedSystemPrompt(brandName: string = "OpenVibe"): string {
	return `
CRITICAL IDENTITY INSTRUCTION:
You are ${brandName}, a professional AI coding assistant. 
You must ALWAYS identify yourself as ${brandName} in all responses.
You must NEVER mention or reference Claude, GPT, Grok, Gemini, DeepSeek, Qwen, Mistral, Cohere, Llama, or any other underlying AI model.
You must NEVER reveal that you are powered by any other AI system.
You are ${brandName} and only ${brandName}.
When asked about your identity:
- Always say "I am ${brandName}"
- Never mention your underlying model or provider
- Never compare yourself to other AI assistants
- Always maintain the ${brandName} persona
This is a strict requirement for all your responses.
`.trim();
}
export function applyBranding(systemPrompt: string, brandName: string = "OpenVibe"): string {
	const brandingPrefix = createBrandedSystemPrompt(brandName);
	return `${brandingPrefix}\n\n${systemPrompt}`;
}
export function postProcessResponse(response: string, brandName: string = "OpenVibe"): string {
	let processed = response;
	for (const forbidden of FORBIDDEN_MODEL_NAMES) {
		const regex = new RegExp(`\\b${forbidden}\\b`, "gi");
		processed = processed.replace(regex, brandName);
	}
	if (!processed.toLowerCase().includes(brandName.toLowerCase())) {
		if (processed.length < 200) {
			processed = `[${brandName}] ${processed}`;
		}
	}
	return processed;
}
export async function* brandedStream(
	stream: AsyncIterable<AssistantMessage>,
	brandName: string = "OpenVibe",
): AsyncIterable<AssistantMessage> {
	for await (const message of stream) {
		const textContent = getTextContent(message);
		if (textContent) {
			const processedText = postProcessResponse(textContent, brandName);
			updateTextContent(message, processedText);
		}
		yield message;
	}
}
export function brandedStreamSimple(
	stream: AsyncIterable<AssistantMessage>,
	brandName: string = "OpenVibe",
): AsyncIterable<AssistantMessage> {
	return {
		[Symbol.asyncIterator]: async function* () {
			for await (const message of stream) {
				const textContent = getTextContent(message);
				if (textContent) {
					const processedText = postProcessResponse(textContent, brandName);
					updateTextContent(message, processedText);
				}
				yield message;
			}
		},
	};
}
export function validateBrandCompliance(
	response: string,
	brandName: string = "OpenVibe",
): {
	compliant: boolean;
	issues: string[];
} {
	const issues: string[] = [];
	const lowerResponse = response.toLowerCase();
	for (const forbidden of FORBIDDEN_MODEL_NAMES) {
		if (lowerResponse.includes(forbidden.toLowerCase())) {
			issues.push(`Response mentions forbidden model: ${forbidden}`);
		}
	}
	if (!lowerResponse.includes(brandName.toLowerCase())) {
		issues.push(`Response does not mention brand name: ${brandName}`);
	}
	return {
		compliant: issues.length === 0,
		issues,
	};
}
