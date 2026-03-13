import type { AssistantMessage, Context, Model } from "@mariozechner/pi-ai";

interface PendingRequest {
	id: string;
	model: Model<any>;
	context: Context;
	resolve: (value: AssistantMessage) => void;
	reject: (error: Error) => void;
	signal?: AbortSignal;
	options?: any;
}
interface ConcurrencyStats {
	activeRequests: number;
	queuedRequests: number;
	totalCompleted: number;
	totalErrors: number;
	averageLatency: number;
}
class ConcurrencyManager {
	private maxConcurrent: number;
	private activeRequests: Set<string> = new Set();
	private queue: PendingRequest[] = [];
	private requestStartTimes: Map<string, number> = new Map();
	private latencies: number[] = [];
	constructor(maxConcurrent: number = 4) {
		this.maxConcurrent = maxConcurrent;
	}
	updateConcurrency(newConcurrency: number): void {
		const _old = this.maxConcurrent;
		this.maxConcurrent = Math.max(1, newConcurrency);
		this.processQueue();
	}
	async execute<T>(requestId: string, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
		if (this.activeRequests.size >= this.maxConcurrent) {
			await this.waitForSlot(requestId, signal);
		}
		if (signal?.aborted) {
			throw new Error("Request aborted");
		}
		this.activeRequests.add(requestId);
		this.requestStartTimes.set(requestId, Date.now());
		try {
			const result = await task();
			return result;
		} finally {
			const startTime = this.requestStartTimes.get(requestId);
			if (startTime) {
				const latency = Date.now() - startTime;
				this.latencies.push(latency);
				if (this.latencies.length > 100) {
					this.latencies.shift();
				}
				this.requestStartTimes.delete(requestId);
			}
			this.activeRequests.delete(requestId);
			this.processQueue();
		}
	}
	private async waitForSlot(_requestId: string, signal?: AbortSignal): Promise<void> {
		return new Promise((resolve, reject) => {
			const checkQueue = () => {
				if (this.activeRequests.size < this.maxConcurrent) {
					resolve();
					return true;
				}
				if (signal?.aborted) {
					reject(new Error("Request aborted"));
					return true;
				}
				return false;
			};
			if (!checkQueue()) {
				const interval = setInterval(() => {
					if (checkQueue()) {
						clearInterval(interval);
					}
				}, 10);
			}
		});
	}
	private processQueue(): void {
		while (this.queue.length > 0 && this.activeRequests.size < this.maxConcurrent) {
			const next = this.queue.shift();
			if (next) {
				this.executeRequest(next);
			}
		}
	}
	private async executeRequest(pending: PendingRequest): Promise<void> {
		try {
			const stream = await import("@mariozechner/pi-ai");
			const response = await stream.streamSimple(pending.model, pending.context, pending.options);
			const result = await response.result();
			pending.resolve(result);
		} catch (error) {
			pending.reject(error instanceof Error ? error : new Error(String(error)));
		}
	}
	getStats(): ConcurrencyStats {
		const avgLatency =
			this.latencies.length > 0 ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length : 0;
		return {
			activeRequests: this.activeRequests.size,
			queuedRequests: this.queue.length,
			totalCompleted: this.latencies.length,
			totalErrors: 0,
			averageLatency: avgLatency,
		};
	}
	clear(): void {
		this.queue.forEach((req) => {
			req.reject(new Error("Queue cleared"));
		});
		this.queue = [];
	}
}
function detectOptimalConcurrency(): number {
	try {
		const os = require("os");
		const cpuCores = os.cpus().length;
		try {
			const result = require("child_process").execSync("wmic path win32_VideoController get name", {
				encoding: "utf-8",
			});
			const gpuCount = (result.match(/Name/g) || []).length;
			return Math.max(2, gpuCount || cpuCores);
		} catch {
			return Math.max(2, Math.floor(cpuCores / 2));
		}
	} catch {
		return 4;
	}
}
const globalConcurrencyManager = new ConcurrencyManager(detectOptimalConcurrency());
export class APIParallelExecutor {
	private concurrencyManager: ConcurrencyManager;
	constructor(concurrency?: number) {
		this.concurrencyManager = concurrency ? new ConcurrencyManager(concurrency) : globalConcurrencyManager;
	}
	async batchRequest(
		requests: Array<{
			model: Model<any>;
			context: Context;
			options?: any;
		}>,
		options?: { signal?: AbortSignal },
	): Promise<AssistantMessage[]> {
		const promises = requests.map((req, index) => {
			return this.concurrencyManager.execute(
				`req-${Date.now()}-${index}`,
				async () => {
					const stream = await import("@mariozechner/pi-ai");
					const response = await stream.streamSimple(req.model, req.context, req.options);
					return response.result();
				},
				options?.signal,
			);
		});
		return Promise.all(promises);
	}
	async *streamBatch(
		requests: Array<{
			model: Model<any>;
			context: Context;
			options?: any;
		}>,
		options?: { signal?: AbortSignal },
	): AsyncGenerator<{ index: number; result: AssistantMessage }, void, void> {
		const promises = requests.map((req, index) => {
			return this.concurrencyManager
				.execute(
					`stream-req-${Date.now()}-${index}`,
					async () => {
						const stream = await import("@mariozechner/pi-ai");
						const response = await stream.streamSimple(req.model, req.context, req.options);
						return response.result();
					},
					options?.signal,
				)
				.then((result) => ({ index, result }));
		});
		const remaining = new Set(promises.map((_p, i) => i));
		while (remaining.size > 0) {
			if (options?.signal?.aborted) {
				throw new Error("Stream batch aborted");
			}
			for (const idx of remaining) {
				const promise = promises[idx];
				if (promise && (await Promise.race([promise, Promise.resolve(null)]))) {
					const result = await promise;
					yield result;
					remaining.delete(idx);
					break;
				}
			}
			if (remaining.size > 0) {
				await new Promise((resolve) => setTimeout(resolve, 5));
			}
		}
	}
	getStats(): ConcurrencyStats {
		return this.concurrencyManager.getStats();
	}
	setConcurrency(concurrency: number): void {
		this.concurrencyManager.updateConcurrency(concurrency);
	}
	getOptimalConcurrency(): number {
		return detectOptimalConcurrency();
	}
	clear(): void {
		this.concurrencyManager.clear();
	}
}
export const globalParallelExecutor = new APIParallelExecutor();
export { detectOptimalConcurrency, type ConcurrencyStats };
