import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions, StreamOptions } from "../types.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";

export type GoogleThinkingLevel = "THINKING_LEVEL_UNSPECIFIED" | "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

export interface GoogleGeminiCliOptions extends StreamOptions {
	toolChoice?: "auto" | "none" | "any";
	thinking?: {
		enabled: boolean;
		budgetTokens?: number;
		level?: GoogleThinkingLevel;
	};
	projectId?: string;
}

export function streamGoogleGeminiCli(
	model: Model<"google-gemini-cli">,
	_context: Context,
	_options?: GoogleGeminiCliOptions,
): AssistantMessageEventStream {
	const stream = new AssistantMessageEventStream();
	(async () => {
		const output: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "Google Gemini CLI provider is not implemented" }],
			api: "google-gemini-cli" as Api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: Date.now(),
		};
		stream.push({ type: "start", partial: output });
		stream.push({ type: "text_start", contentIndex: 0, partial: output });
		stream.push({
			type: "text_delta",
			contentIndex: 0,
			delta: "Google Gemini CLI provider is not implemented",
			partial: output,
		});
		stream.push({
			type: "text_end",
			contentIndex: 0,
			content: "Google Gemini CLI provider is not implemented",
			partial: output,
		});
		stream.end(output);
	})();
	return stream;
}

export function streamSimpleGoogleGeminiCli(
	model: Model<"google-gemini-cli">,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream {
	return streamGoogleGeminiCli(model, context, options);
}
