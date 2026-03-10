import type { AssistantMessage, AssistantMessageEvent, Model } from "@mariozechner/pi-ai";

interface StreamBuffer {
	chunks: string[];
	complete: boolean;
	error?: Error;
}
interface AcceleratedStreamOptions {
	prefetch?: boolean;
	bufferSize?: number;
	priority?: "speed" | "quality" | "balanced";
}
export class ResponseBuffer {
	private chunks: string[] = [];
	private totalLength = 0;
	private textDecoder = new TextDecoder();
	append(chunk: string | Uint8Array): void {
		if (typeof chunk === "string") {
			this.chunks.push(chunk);
			this.totalLength += chunk.length;
		} else {
			const text = this.textDecoder.decode(chunk, { stream: true });
			this.chunks.push(text);
			this.totalLength += text.length;
		}
	}
	getText(): string {
		if (this.chunks.length === 0) return "";
		if (this.chunks.length === 1) return this.chunks[0];
		return this.chunks.join("");
	}
	getChunks(): string[] {
		return this.chunks;
	}
	clear(): void {
		this.chunks = [];
		this.totalLength = 0;
	}
	get length(): number {
		return this.totalLength;
	}
}
export class StreamingAccelerator {
	private activeBuffer: ResponseBuffer = new ResponseBuffer();
	private backBuffer: ResponseBuffer = new ResponseBuffer();
	private isProcessing = false;
	async *streamChunks(
		generator: AsyncGenerator<AssistantMessageEvent>,
		options: AcceleratedStreamOptions = {},
	): AsyncGenerator<AssistantMessageEvent> {
		const { priority = "balanced" } = options;
		if (priority === "speed") {
			process.env.NODE_OPTIONS = "--max-old-space-size=8192";
		}
		for await (const event of generator) {
			yield event;
			if (event.type === "text_delta" && event.delta) {
				this.activeBuffer.append(event.delta);
			}
		}
		const temp = this.activeBuffer;
		this.activeBuffer = this.backBuffer;
		this.backBuffer = temp;
		this.backBuffer.clear();
	}
	getAccumulatedText(): string {
		return this.activeBuffer.getText();
	}
}
export class ConnectionPool {
	private connections = new Map<string, any>();
	private maxConnections: number;
	constructor(maxConnections: number = 4) {
		this.maxConnections = maxConnections;
	}
	getConnection(modelId: string): any {
		if (this.connections.has(modelId)) {
			return this.connections.get(modelId);
		}
		const connection = this.createConnection(modelId);
		if (this.connections.size >= this.maxConnections) {
			const firstKey = this.connections.keys().next().value;
			if (firstKey !== undefined) {
				this.connections.delete(firstKey);
			}
		}
		this.connections.set(modelId, connection);
		return connection;
	}
	private createConnection(modelId: string): any {
		return { modelId, createdAt: Date.now() };
	}
	clear(): void {
		this.connections.clear();
	}
}
export class ResponseCache {
	private cache = new Map<string, { response: AssistantMessage; timestamp: number }>();
	private ttl: number;
	constructor(ttlMs: number = 60000) {
		this.ttl = ttlMs;
	}
	private generateKey(messages: any[], model: Model<any>): string {
		const messageHash = JSON.stringify(messages).slice(0, 200);
		return `${model.provider}:${model.id ?? "unknown"}:${messageHash}`;
	}
	get(messages: any[], model: Model<any>): AssistantMessage | undefined {
		const key = this.generateKey(messages, model);
		const entry = this.cache.get(key);
		if (entry && Date.now() - entry.timestamp < this.ttl) {
			return entry.response;
		}
		if (entry) {
			this.cache.delete(key);
		}
		return undefined;
	}
	set(messages: any[], model: Model<any>, response: AssistantMessage): void {
		const key = this.generateKey(messages, model);
		this.cache.set(key, { response, timestamp: Date.now() });
		this.cleanup();
	}
	private cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache) {
			if (now - entry.timestamp > this.ttl) {
				this.cache.delete(key);
			}
		}
	}
	clear(): void {
		this.cache.clear();
	}
}
export async function warmupModel(model: Model<any>): Promise<void> {
	console.log(`Warming up model: ${model.id}`);
}
export function optimizeContext(messages: any[]): any[] {
	return messages.map((msg) => {
		if (typeof msg.content === "string") {
			return {
				...msg,
				content: msg.content.replace(/\n{3,}/g, "\n\n").trim(),
			};
		}
		return msg;
	});
}
export const globalAccelerator = new StreamingAccelerator();
export const globalConnectionPool = new ConnectionPool();
export const globalResponseCache = new ResponseCache();
export async function* accelerateStream(
	generator: AsyncGenerator<AssistantMessageEvent>,
	options?: AcceleratedStreamOptions,
): AsyncGenerator<AssistantMessageEvent> {
	yield* globalAccelerator.streamChunks(generator, options);
}
export function getCachedResponse(messages: any[], model: Model<any>): AssistantMessage | undefined {
	return globalResponseCache.get(messages, model);
}
export function cacheResponse(messages: any[], model: Model<any>, response: AssistantMessage): void {
	globalResponseCache.set(messages, model, response);
}
