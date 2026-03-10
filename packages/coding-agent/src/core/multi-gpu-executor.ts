import { cpus } from "os";

interface Task<T = any, R = any> {
	id: string;
	data: T;
	processor: (data: T) => Promise<R> | R;
}
interface AsyncPoolConfig {
	concurrency: number;
}
interface GPUStats {
	gpuCount: number;
	cpuCores: number;
	optimalConcurrency: number;
}
class AsyncPool {
	private concurrency: number;
	private running = 0;
	private queue: Array<{
		task: () => Promise<any>;
		resolve: (value: any) => void;
		reject: (error: Error) => void;
	}> = [];
	constructor(concurrency: number) {
		this.concurrency = concurrency;
	}
	async execute<T>(task: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.queue.push({ task, resolve, reject });
			this.processQueue();
		});
	}
	private processQueue(): void {
		while (this.running < this.concurrency && this.queue.length > 0) {
			const { task, resolve, reject } = this.queue.shift()!;
			this.running++;
			task()
				.then(resolve)
				.catch(reject)
				.finally(() => {
					this.running--;
					this.processQueue();
				});
		}
	}
	updateConcurrency(newConcurrency: number): void {
		this.concurrency = Math.max(1, newConcurrency);
		this.processQueue();
	}
	getStats() {
		return {
			running: this.running,
			queued: this.queue.length,
			concurrency: this.concurrency,
		};
	}
}
export class MultiGPUExecutor {
	private computePool: AsyncPool;
	private ioPool: AsyncPool;
	private stats = {
		tasksSubmitted: 0,
		tasksCompleted: 0,
		tasksFailed: 0,
		totalExecutionTime: 0,
	};
	constructor() {
		const hardware = this.detectHardware();
		this.computePool = new AsyncPool(Math.max(2, hardware.gpuCount * 2));
		this.ioPool = new AsyncPool(hardware.cpuCores * 2);
	}
	private detectHardware(): GPUStats {
		const cpuCores = cpus().length;
		let gpuCount = 0;
		try {
			const { execSync } = require("child_process");
			const result = execSync("nvidia-smi -L", { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
			gpuCount = result
				.trim()
				.split("\n")
				.filter((line: string) => line.includes("GPU")).length;
		} catch {
			try {
				const { execSync } = require("child_process");
				const result = execSync("wmic path win32_VideoController get name", {
					encoding: "utf-8",
					stdio: ["pipe", "pipe", "ignore"],
				});
				gpuCount = Math.max(
					0,
					result.split("\n").filter((line: string) => line.trim() && !line.includes("Name")).length - 1,
				);
			} catch {
				gpuCount = 0;
			}
		}
		const optimalConcurrency = Math.max(gpuCount * 2, cpuCores);
		return {
			gpuCount: Math.max(1, gpuCount),
			cpuCores,
			optimalConcurrency,
		};
	}
	async compute<T, R>(data: T, processor: (data: T) => R | Promise<R>): Promise<R> {
		const startTime = Date.now();
		this.stats.tasksSubmitted++;
		try {
			const result = await this.computePool.execute(async () => {
				return processor(data);
			});
			this.stats.tasksCompleted++;
			this.stats.totalExecutionTime += Date.now() - startTime;
			return result;
		} catch (error) {
			this.stats.tasksFailed++;
			throw error;
		}
	}
	async io<T>(task: () => Promise<T>): Promise<T> {
		const startTime = Date.now();
		this.stats.tasksSubmitted++;
		try {
			const result = await this.ioPool.execute(task);
			this.stats.tasksCompleted++;
			this.stats.totalExecutionTime += Date.now() - startTime;
			return result;
		} catch (error) {
			this.stats.tasksFailed++;
			throw error;
		}
	}
	async parallel<T, R>(tasks: Array<{ data: T; processor: (data: T) => R | Promise<R> }>): Promise<R[]> {
		return Promise.all(tasks.map((t) => this.compute(t.data, t.processor)));
	}
	async parallelIO<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
		return Promise.all(tasks.map((t) => this.io(t)));
	}
	async *parallelStream<T, R>(
		source: AsyncIterable<T>,
		processor: (data: T) => R | Promise<R>,
		options?: { bufferSize?: number },
	): AsyncGenerator<R, void, void> {
		const bufferSize = options?.bufferSize ?? 10;
		const buffer: Promise<R>[] = [];
		for await (const item of source) {
			const promise = this.compute(item, processor);
			buffer.push(promise);
			if (buffer.length >= bufferSize) {
				yield await buffer.shift()!;
			}
		}
		while (buffer.length > 0) {
			yield await buffer.shift()!;
		}
	}
	async batch<T, R>(
		items: T[],
		processor: (item: T) => R | Promise<R>,
		options?: { batchSize?: number },
	): Promise<R[]> {
		const batchSize = options?.batchSize ?? 10;
		const results: R[] = [];
		for (let i = 0; i < items.length; i += batchSize) {
			const batch = items.slice(i, i + batchSize);
			const batchResults = await this.parallel(batch.map((item) => ({ data: item, processor })));
			results.push(...batchResults);
		}
		return results;
	}
	async mapReduce<T, M, R>(
		items: T[],
		mapper: (item: T) => M | Promise<M>,
		reducer: (results: M[]) => R | Promise<R>,
	): Promise<R> {
		const mapped = await this.batch(items, mapper);
		return this.compute(mapped, reducer);
	}
	getStats() {
		const avgTime = this.stats.tasksCompleted > 0 ? this.stats.totalExecutionTime / this.stats.tasksCompleted : 0;
		return {
			...this.stats,
			computePool: this.computePool.getStats(),
			ioPool: this.ioPool.getStats(),
			averageExecutionTime: avgTime,
		};
	}
	setConcurrency(computeConcurrency: number, ioConcurrency?: number): void {
		this.computePool.updateConcurrency(computeConcurrency);
		if (ioConcurrency) {
			this.ioPool.updateConcurrency(ioConcurrency);
		}
	}
}
export const globalMultiGPUExecutor = new MultiGPUExecutor();
export function detectGPUCount(): number {
	try {
		const { execSync } = require("child_process");
		const result = execSync("nvidia-smi -L", { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
		return result
			.trim()
			.split("\n")
			.filter((line: string) => line.includes("GPU")).length;
	} catch {
		try {
			const { execSync } = require("child_process");
			const result = execSync("wmic path win32_VideoController get name", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "ignore"],
			});
			return Math.max(
				0,
				result.split("\n").filter((line: string) => line.trim() && !line.includes("Name")).length - 1,
			);
		} catch {
			return 0;
		}
	}
}
export function detectCPUCores(): number {
	return cpus().length;
}
export function getHardwareInfo(): GPUStats {
	const gpuCount = detectGPUCount();
	const cpuCores = detectCPUCores();
	return {
		gpuCount: Math.max(1, gpuCount),
		cpuCores,
		optimalConcurrency: Math.max(gpuCount * 2, cpuCores),
	};
}
