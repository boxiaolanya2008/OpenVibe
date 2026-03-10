import { cpus, freemem, totalmem } from "os";

const MAX_CONCURRENCY = Math.max(4, cpus().length * 2);
interface Task<T = any> {
	id: string;
	fn: () => Promise<T> | T;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	priority: number;
	timestamp: number;
}
interface SystemResources {
	cpus: number;
	totalMemory: number;
	freeMemory: number;
	gpuAvailable: boolean;
}
function getSystemResources(): SystemResources {
	return {
		cpus: cpus().length,
		totalMemory: totalmem(),
		freeMemory: freemem(),
		gpuAvailable: process.env.CUDA_VISIBLE_DEVICES !== undefined,
	};
}
class PriorityTaskQueue<T> {
	private queues: Map<number, Task<T>[]> = new Map();
	private taskMap: Map<string, Task<T>> = new Map();
	private priorities: number[] = [];
	enqueue(task: Task<T>): void {
		const { priority } = task;
		if (!this.queues.has(priority)) {
			this.queues.set(priority, []);
			this.priorities = Array.from(this.queues.keys()).sort((a, b) => b - a);
		}
		this.queues.get(priority)!.push(task);
		this.taskMap.set(task.id, task);
	}
	dequeue(): Task<T> | undefined {
		for (const priority of this.priorities) {
			const queue = this.queues.get(priority);
			if (queue && queue.length > 0) {
				const task = queue.shift()!;
				this.taskMap.delete(task.id);
				return task;
			}
		}
		return undefined;
	}
	get size(): number {
		return this.taskMap.size;
	}
	get isEmpty(): boolean {
		return this.taskMap.size === 0;
	}
}
class AsyncTaskExecutor {
	private queue = new PriorityTaskQueue<any>();
	private running = 0;
	private maxConcurrency: number;
	constructor(maxConcurrency: number = MAX_CONCURRENCY) {
		this.maxConcurrency = maxConcurrency;
	}
	execute<T>(fn: () => Promise<T> | T, priority: number = 5): Promise<T> {
		return new Promise((resolve, reject) => {
			const task: Task<T> = {
				id: Math.random().toString(36).substring(2),
				fn,
				resolve,
				reject,
				priority,
				timestamp: Date.now(),
			};
			this.queue.enqueue(task);
			this.processQueue();
		});
	}
	private async processQueue(): Promise<void> {
		if (this.running >= this.maxConcurrency || this.queue.isEmpty) {
			return;
		}
		const task = this.queue.dequeue();
		if (!task) return;
		this.running++;
		try {
			const result = await task.fn();
			task.resolve(result);
		} catch (error) {
			task.reject(error instanceof Error ? error : new Error(String(error)));
		} finally {
			this.running--;
			setImmediate(() => this.processQueue());
		}
	}
}
const globalExecutor = new AsyncTaskExecutor();
export async function parallelExecute<T, R>(
	items: T[],
	mapper: (item: T, index: number) => Promise<R> | R,
	options: {
		concurrency?: number;
		priority?: number;
	} = {},
): Promise<R[]> {
	const { concurrency = MAX_CONCURRENCY, priority = 5 } = options;
	if (items.length === 0) return [];
	if (items.length === 1) return [await mapper(items[0], 0)];
	if (items.length <= 4) {
		return Promise.all(items.map((item, index) => mapper(item, index)));
	}
	const results: (R | undefined)[] = new Array(items.length);
	const iterator = items.entries();
	async function worker(): Promise<void> {
		for (const [index, item] of iterator) {
			try {
				results[index] = await mapper(item, index);
			} catch (error) {
				throw error;
			}
		}
	}
	const workers = Array(Math.min(concurrency, items.length))
		.fill(null)
		.map(() => worker());
	await Promise.all(workers);
	return results as R[];
}
export class BatchProcessor<T, R> {
	private queue: T[] = [];
	private processing = false;
	private results: Map<string, R> = new Map();
	private readonly concurrency: number;
	constructor(
		private processor: (items: T[]) => Promise<R[]>,
		options: { concurrency?: number; batchSize?: number } = {},
	) {
		this.concurrency = options.concurrency || MAX_CONCURRENCY;
	}
	async add(item: T): Promise<R> {
		const id = Math.random().toString(36).substring(2);
		this.queue.push(item);
		if (!this.processing) {
			this.processing = true;
			setImmediate(() => this.processBatch());
		}
		return new Promise((resolve, reject) => {
			const check = () => {
				if (this.results.has(id)) {
					const result = this.results.get(id)!;
					this.results.delete(id);
					resolve(result);
				} else if (this.queue.length === 0 && !this.processing) {
					reject(new Error("Processing failed"));
				} else {
					setTimeout(check, 10);
				}
			};
			check();
		});
	}
	private async processBatch(): Promise<void> {
		if (this.queue.length === 0) {
			this.processing = false;
			return;
		}
		const batch = this.queue.splice(0, this.concurrency);
		try {
			const results = await this.processor(batch);
			results.forEach((result, index) => {
				const id = Math.random().toString(36).substring(2);
				this.results.set(id, result);
			});
		} catch (error) {
			console.error("Batch processing error:", error);
		}
		if (this.queue.length > 0) {
			setImmediate(() => this.processBatch());
		} else {
			this.processing = false;
		}
	}
}
export class MemoryMappedCache {
	private cache = new Map<string, { data: Buffer; timestamp: number }>();
	private maxSize: number;
	private currentSize = 0;
	constructor(maxSizeMB: number = 512) {
		this.maxSize = maxSizeMB * 1024 * 1024;
	}
	get(key: string): Buffer | undefined {
		const entry = this.cache.get(key);
		if (entry) {
			entry.timestamp = Date.now();
			return entry.data;
		}
		return undefined;
	}
	set(key: string, data: Buffer): void {
		const size = data.length;
		if (size > this.maxSize / 4) return;
		while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
			this.evictLRU();
		}
		this.cache.set(key, { data, timestamp: Date.now() });
		this.currentSize += size;
	}
	private evictLRU(): void {
		let oldest: { key: string; timestamp: number } | null = null;
		for (const [key, entry] of this.cache) {
			if (!oldest || entry.timestamp < oldest.timestamp) {
				oldest = { key, timestamp: entry.timestamp };
			}
		}
		if (oldest) {
			const entry = this.cache.get(oldest.key);
			if (entry) {
				this.currentSize -= entry.data.length;
				this.cache.delete(oldest.key);
			}
		}
	}
	clear(): void {
		this.cache.clear();
		this.currentSize = 0;
	}
	getStats(): { entries: number; sizeMB: number } {
		return {
			entries: this.cache.size,
			sizeMB: Math.round((this.currentSize / 1024 / 1024) * 100) / 100,
		};
	}
}
export class PerformanceMetrics {
	private metrics = new Map<string, number[]>();
	record(operation: string, duration: number): void {
		if (!this.metrics.has(operation)) {
			this.metrics.set(operation, []);
		}
		this.metrics.get(operation)!.push(duration);
	}
	getStats(operation: string): { avg: number; min: number; max: number; count: number } | undefined {
		const times = this.metrics.get(operation);
		if (!times || times.length === 0) return undefined;
		const sum = times.reduce((a, b) => a + b, 0);
		return {
			avg: Math.round(sum / times.length),
			min: Math.min(...times),
			max: Math.max(...times),
			count: times.length,
		};
	}
	getAllStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
		const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};
		for (const [op] of this.metrics) {
			const s = this.getStats(op);
			if (s) stats[op] = s;
		}
		return stats;
	}
	reset(): void {
		this.metrics.clear();
	}
}
export const globalMetrics = new PerformanceMetrics();
export const globalCache = new MemoryMappedCache(512);
export { getSystemResources, MAX_CONCURRENCY };
