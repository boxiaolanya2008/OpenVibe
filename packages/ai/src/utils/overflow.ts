import type { AssistantMessage } from "../types.js";

const OVERFLOW_PATTERNS = [
	/prompt is too long/i,
	/input is too long for requested model/i,
	/exceeds the context window/i,
	/input token count.*exceeds the maximum/i,
	/maximum prompt length is \d+/i,
	/reduce the length of the messages/i,
	/maximum context length is \d+ tokens/i,
	/exceeds the limit of \d+/i,
	/exceeds the available context size/i,
	/greater than the context length/i,
	/context window exceeds limit/i,
	/exceeded model token limit/i,
	/too large for model with \d+ maximum context length/i,
	/model_context_window_exceeded/i,
	/context[_ ]length[_ ]exceeded/i,
	/too many tokens/i,
	/token limit exceeded/i,
];
export function isContextOverflow(message: AssistantMessage, contextWindow?: number): boolean {
	if (message.stopReason === "error" && message.errorMessage) {
		if (OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage!))) {
			return true;
		}
		if (/^4(00|13)\s*(status code)?\s*\(no body\)/i.test(message.errorMessage)) {
			return true;
		}
	}
	if (contextWindow && message.stopReason === "stop") {
		const inputTokens = message.usage.input + message.usage.cacheRead;
		if (inputTokens > contextWindow) {
			return true;
		}
	}
	return false;
}
export function getOverflowPatterns(): RegExp[] {
	return [...OVERFLOW_PATTERNS];
}
