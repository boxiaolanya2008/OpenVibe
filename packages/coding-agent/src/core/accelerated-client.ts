import type { Api, AssistantMessage, Context, Model } from "@mariozechner/pi-ai";
import { APIParallelExecutor } from "./api-concurrency.js";
import { accelerateStream } from "./response-accelerator.js";

interface BatchRequestOptions {
	model: Model<any>;
	context: Context;
	options?: any;
}
interface RateLimiterConfig {
	maxRequestsPerSecond?: number;
	maxRequestsPerMinute?: number;
}
class RateLimiter {
	private requests: number[] = [];
	private maxPerSecond: number;
	private maxPerMinute: number;
	constructor(config: RateLimiterConfig = {}) {
		this.maxPerSecond = config.maxRequestsPerSecond ?? 60;
		this.maxPerMinute = (config as any).maxRequestsPerMinute ?? 600;
	}
	async acquire(): Promise<void> {
		const now = Date.now();
		this.requests = this.requests.filter((timestamp) => now - timestamp < 60000);
		if (this.requests.length >= this.maxPerMinute) {
			const oldestRequest = this.requests[0];
			const waitTime = 60000 - (now - oldestRequest) + 100;
			await new Promise((resolve) => setTimeout(resolve, waitTime));
			return this.acquire();
		}
		const recentRequests = this.requests.filter((timestamp) => now - timestamp < 1000);
		if (recentRequests.length >= this.maxPerSecond) {
			const oldestRecent = recentRequests[0];
			const waitTime = 1000 - (now - oldestRecent) + 100;
			await new Promise((resolve) => setTimeout(resolve, waitTime));
			return this.acquire();
		}
		this.requests.push(now);
	}
	getStats(): { requestsThisSecond: number; requestsThisMinute: number } {
		const now = Date.now();
		const requestsThisSecond = this.requests.filter((timestamp) => now - timestamp < 1000).length;
		const requestsThisMinute = this.requests.length;
		return { requestsThisSecond, requestsThisMinute };
	}
}
export class AcceleratedAPIClient {
	private executor: APIParallelExecutor;
	private rateLimiter: RateLimiter;
	constructor(options?: {
		concurrency?: number;
		rateLimiter?: RateLimiterConfig;
	}) {
		this.executor = new APIParallelExecutor(options?.concurrency);
		this.rateLimiter = new RateLimiter(options?.rateLimiter);
	}
	async singleRequest(model: Model<any>, context: Context, options?: any): Promise<AssistantMessage> {
		await this.rateLimiter.acquire();
		const stream = await import("@mariozechner/pi-ai");
		const response = await stream.streamSimple(model, context, options);
		return response.result();
	}
	async *singleStreamRequest(model: Model<any>, context: Context, options?: any): AsyncGenerator<any, void, void> {
		await this.rateLimiter.acquire();
		const stream = await import("@mariozechner/pi-ai");
		const response = await stream.streamSimple(model, context, options);
		yield* accelerateStream(response as any, { priority: "speed" });
	}
	async batchRequest(
		requests: BatchRequestOptions[],
		options?: { signal?: AbortSignal },
	): Promise<AssistantMessage[]> {
		for (let i = 0; i < requests.length; i++) {
			await this.rateLimiter.acquire();
		}
		return this.executor.batchRequest(requests, options);
	}
	async *streamBatch(
		requests: BatchRequestOptions[],
		options?: { signal?: AbortSignal },
	): AsyncGenerator<{ index: number; result: AssistantMessage }, void, void> {
		for (let i = 0; i < requests.length; i++) {
			await this.rateLimiter.acquire();
		}
		yield* this.executor.streamBatch(requests, options);
	}
	async throttledBatch(requests: BatchRequestOptions[], requestsPerSecond = 10): Promise<AssistantMessage[]> {
		const delay = 1000 / requestsPerSecond;
		const results: AssistantMessage[] = [];
		const concurrency = this.executor.getOptimalConcurrency();
		for (let i = 0; i < requests.length; i += concurrency) {
			const batch = requests.slice(i, i + concurrency);
			await this.rateLimiter.acquire();
			const batchPromises = batch.map((req) => this.singleRequest(req.model, req.context, req.options));
			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);
			if (i + concurrency < requests.length) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
		return results;
	}
	getStats() {
		return {
			concurrency: this.executor.getStats(),
			rateLimiter: this.rateLimiter.getStats(),
		};
	}
	setConcurrency(concurrency: number): void {
		this.executor.setConcurrency(concurrency);
	}
	clear(): void {
		this.executor.clear();
	}
}
export const globalAcceleratedClient = new AcceleratedAPIClient();
