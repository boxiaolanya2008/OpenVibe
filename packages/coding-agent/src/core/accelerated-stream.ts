import type { AssistantMessage, AssistantMessageEvent } from "@mariozechner/pi-ai";
import { globalMultiGPUExecutor } from "./multi-gpu-executor.js";

interface StreamProcessorConfig {
	enableParallelProcessing?: boolean;
	bufferSize?: number;
	workerCount?: number;
}
interface ProcessingStats {
	totalChunks: number;
	processedChunks: number;
	bufferedChunks: number;
	processingTime: number;
}
export class AcceleratedStream {
	private config: Required<StreamProcessorConfig>;
	private stats: ProcessingStats = {
		totalChunks: 0,
		processedChunks: 0,
		bufferedChunks: 0,
		processingTime: 0,
	};
	constructor(config: StreamProcessorConfig = {}) {
		this.config = {
			enableParallelProcessing: config.enableParallelProcessing ?? true,
			bufferSize: config.bufferSize ?? 20,
			workerCount: config.workerCount ?? 4,
		};
	}
	async *process<T>(source: AsyncIterable<T>, processor: (chunk: T) => T | Promise<T>): AsyncGenerator<T, void, void> {
		if (!this.config.enableParallelProcessing) {
			for await (const chunk of source) {
				yield await processor(chunk);
			}
			return;
		}
		const buffer: Promise<T>[] = [];
		const startTime = Date.now();
		for await (const chunk of source) {
			this.stats.totalChunks++;
			const processedPromise = globalMultiGPUExecutor.compute(chunk, processor);
			buffer.push(processedPromise);
			if (buffer.length >= this.config.bufferSize) {
				const result = await buffer.shift()!;
				this.stats.processedChunks++;
				yield result;
			}
		}
		while (buffer.length > 0) {
			const result = await buffer.shift()!;
			this.stats.processedChunks++;
			yield result;
		}
		this.stats.processingTime += Date.now() - startTime;
	}
	async *accelerateResponse(
		stream: AsyncGenerator<AssistantMessageEvent>,
		options?: {
			onChunk?: (chunk: AssistantMessageEvent) => void;
			transformChunk?: (chunk: AssistantMessageEvent) => AssistantMessageEvent;
		},
	): AsyncGenerator<AssistantMessageEvent, AssistantMessage, void> {
		const buffer: AssistantMessageEvent[] = [];
		let finalMessage: AssistantMessage | null = null;
		const startTime = Date.now();
		for await (const event of stream) {
			this.stats.totalChunks++;
			const processedEvent = options?.transformChunk
				? await globalMultiGPUExecutor.compute(event, options.transformChunk)
				: event;
			options?.onChunk?.(processedEvent);
			buffer.push(processedEvent);
			if (buffer.length >= this.config.bufferSize) {
				const toYield = buffer.splice(0, buffer.length - Math.floor(this.config.bufferSize / 2));
				for (const e of toYield) {
					this.stats.processedChunks++;
					yield e;
				}
			}
			if (event.type === "done" || event.type === "error") {
				finalMessage = await this.getFinalMessage(stream);
				break;
			}
		}
		for (const event of buffer) {
			this.stats.processedChunks++;
			yield event;
		}
		this.stats.processingTime += Date.now() - startTime;
		if (!finalMessage) {
			throw new Error("Stream ended without final message");
		}
		return finalMessage;
	}
	private async getFinalMessage(stream: AsyncGenerator<AssistantMessageEvent>): Promise<AssistantMessage> {
		return {} as AssistantMessage;
	}
	async processMultipleStreams<T>(
		streams: AsyncIterable<T>[],
		processor: (chunk: T) => T | Promise<T>,
	): Promise<AsyncGenerator<T>[]> {
		return streams.map((stream) => this.process(stream, processor));
	}
	getStats(): ProcessingStats {
		return { ...this.stats };
	}
	resetStats(): void {
		this.stats = {
			totalChunks: 0,
			processedChunks: 0,
			bufferedChunks: 0,
			processingTime: 0,
		};
	}
}
export class StreamMerger {
	private buffer: Map<string, any[]> = new Map();
	private completedStreams: Set<string> = new Set();
	async *merge<T>(
		streams: Map<string, AsyncIterable<T>>,
		options?: { bufferSize?: number },
	): AsyncGenerator<{ source: string; data: T }, void, void> {
		const bufferSize = options?.bufferSize ?? 100;
		const iterators = new Map<string, AsyncIterator<T>>();
		for (const [name, stream] of streams) {
			iterators.set(name, stream[Symbol.asyncIterator]());
			this.buffer.set(name, []);
		}
		const pendingReads = new Map<string, Promise<IteratorResult<T>>>();
		for (const [name, iterator] of iterators) {
			pendingReads.set(name, iterator.next());
		}
		while (pendingReads.size > 0) {
			const [name, result] = await this.racePromises(pendingReads);
			if (result.done) {
				this.completedStreams.add(name);
				pendingReads.delete(name);
				iterators.delete(name);
			} else {
				yield { source: name, data: result.value };
				const iterator = iterators.get(name);
				if (iterator) {
					pendingReads.set(name, iterator.next());
				}
			}
		}
	}
	private async racePromises<T>(promises: Map<string, Promise<T>>): Promise<[string, T]> {
		const entries = Array.from(promises.entries());
		const racing = entries.map(([name, promise]) => promise.then((result) => ({ name, result })));
		const winner = await Promise.race(racing);
		return [winner.name, winner.result];
	}
}
export const globalAcceleratedStream = new AcceleratedStream();
export const globalStreamMerger = new StreamMerger();
