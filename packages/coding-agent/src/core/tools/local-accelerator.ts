import { readFile as fsReadFile, writeFile as fsWriteFile, mkdir } from "fs/promises";
import { cpus, freemem, totalmem } from "os";
import { dirname } from "path";
import { parallelExecute as parallelExec } from "./parallel-executor.js";

interface SystemResources {
	cpus: number;
	totalMemory: number;
	freeMemory: number;
	gpuAvailable: boolean;
	gpuType?: string;
}
interface CacheEntry {
	data: string;
	timestamp: number;
	size: number;
}
function getSystemResources(): SystemResources {
	const cpuCount = cpus().length;
	const totalMem = totalmem();
	const freeMem = freemem();
	let gpuAvailable = false;
	let gpuType: string | undefined;
	if (process.env.CUDA_VISIBLE_DEVICES !== undefined) {
		gpuAvailable = true;
		gpuType = "cuda";
	} else if (process.platform === "darwin" && process.arch === "arm64") {
		gpuAvailable = true;
		gpuType = "metal";
	}
	return {
		cpus: cpuCount,
		totalMemory: totalMem,
		freeMemory: freeMem,
		gpuAvailable,
		gpuType,
	};
}
class FileCache {
	private cache = new Map<string, CacheEntry>();
	private maxSize: number;
	private currentSize = 0;
	private enabled: boolean;
	constructor(maxMemoryMB: number = 512, enabled: boolean = true) {
		this.maxSize = maxMemoryMB * 1024 * 1024;
		this.enabled = enabled;
	}
	get(key: string): string | undefined {
		if (!this.enabled) return undefined;
		const entry = this.cache.get(key);
		if (entry) {
			entry.timestamp = Date.now();
			return entry.data;
		}
		return undefined;
	}
	set(key: string, data: string): void {
		if (!this.enabled) return;
		const size = Buffer.byteLength(data, "utf-8");
		if (size > this.maxSize / 4) return;
		while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
			this.evictLRU();
		}
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			size,
		});
		this.currentSize += size;
	}
	invalidate(key: string): void {
		const entry = this.cache.get(key);
		if (entry) {
			this.currentSize -= entry.size;
			this.cache.delete(key);
		}
	}
	clear(): void {
		this.cache.clear();
		this.currentSize = 0;
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
				this.currentSize -= entry.size;
				this.cache.delete(oldest.key);
			}
		}
	}
	getStats(): { entries: number; sizeMB: number } {
		return {
			entries: this.cache.size,
			sizeMB: Math.round((this.currentSize / 1024 / 1024) * 100) / 100,
		};
	}
}
const globalFileCache = new FileCache(512, true);
async function parallelExecute<T, R>(items: T[], workerCount: number, taskFn: (item: T) => Promise<R>): Promise<R[]> {
	return parallelExec(items, taskFn, {
		concurrency: workerCount,
		priority: 5,
	});
}
export async function acceleratedReadFile(absolutePath: string, useCache: boolean = true): Promise<Buffer> {
	const cached = useCache ? globalFileCache.get(absolutePath) : undefined;
	if (cached !== undefined) {
		return Buffer.from(cached, "utf-8");
	}
	const content = await fsReadFile(absolutePath);
	if (useCache && content.length < 1024 * 1024) {
		globalFileCache.set(absolutePath, content.toString("utf-8"));
	}
	return content;
}
export async function acceleratedWriteFile(absolutePath: string, content: string): Promise<void> {
	const dir = dirname(absolutePath);
	await mkdir(dir, { recursive: true });
	await fsWriteFile(absolutePath, content, "utf-8");
	globalFileCache.invalidate(absolutePath);
}
export async function parallelReadFiles(
	paths: string[],
	useCache: boolean = true,
): Promise<{ path: string; content: Buffer }[]> {
	const resources = getSystemResources();
	const workerCount = Math.min(resources.cpus, paths.length, 8);
	return parallelExecute(paths, workerCount, async (path) => ({
		path,
		content: await acceleratedReadFile(path, useCache),
	}));
}
export async function parallelWriteFiles(
	files: { path: string; content: string }[],
): Promise<{ path: string; bytesWritten: number }[]> {
	const resources = getSystemResources();
	const workerCount = Math.min(resources.cpus, files.length, 8);
	const dirs = new Set(files.map((f) => dirname(f.path)));
	await parallelExecute(Array.from(dirs), workerCount, async (dir) => mkdir(dir, { recursive: true }));
	return parallelExecute(files, workerCount, async (file) => {
		await acceleratedWriteFile(file.path, file.content);
		return {
			path: file.path,
			bytesWritten: Buffer.byteLength(file.content, "utf-8"),
		};
	});
}
export async function parallelGrep(
	paths: string[],
	pattern: string,
): Promise<{ path: string; matches: { line: number; content: string }[] }[]> {
	const resources = getSystemResources();
	const workerCount = Math.min(resources.cpus, paths.length, 8);
	const regex = new RegExp(pattern, "g");
	return parallelExecute(paths, workerCount, async (path) => {
		const content = await acceleratedReadFile(path, true);
		const text = content.toString("utf-8");
		const lines = text.split("\n");
		const matches: { line: number; content: string }[] = [];
		lines.forEach((line, index) => {
			regex.lastIndex = 0;
			if (regex.test(line)) {
				matches.push({ line: index + 1, content: line });
			}
		});
		return { path, matches };
	});
}
export async function parallelReplace(
	paths: string[],
	pattern: string,
	replacement: string,
): Promise<{ path: string; replacements: number }[]> {
	const resources = getSystemResources();
	const workerCount = Math.min(resources.cpus, paths.length, 8);
	const regex = new RegExp(pattern, "g");
	return parallelExecute(paths, workerCount, async (path) => {
		const buffer = await acceleratedReadFile(path, false);
		const content = buffer.toString("utf-8");
		let matchCount = 0;
		const newContent = content.replace(regex, (_match) => {
			matchCount++;
			return replacement;
		});
		if (matchCount > 0) {
			await acceleratedWriteFile(path, newContent);
		}
		return { path, replacements: matchCount };
	});
}
export function getCacheStats(): { entries: number; sizeMB: number } {
	return globalFileCache.getStats();
}
export function clearFileCache(): void {
	globalFileCache.clear();
}
export function getAcceleratorResources(): SystemResources {
	return getSystemResources();
}
export interface AcceleratorConfig {
	enabled: boolean;
	cacheEnabled: boolean;
	maxCacheSizeMB: number;
	maxWorkers: number;
}
let acceleratorConfig: AcceleratorConfig = {
	enabled: true,
	cacheEnabled: true,
	maxCacheSizeMB: 256,
	maxWorkers: Math.min(cpus().length, 8),
};
export function configureAccelerator(config: Partial<AcceleratorConfig>): void {
	acceleratorConfig = { ...acceleratorConfig, ...config };
}
export function isAcceleratorEnabled(): boolean {
	return acceleratorConfig.enabled;
}
export { globalFileCache, getSystemResources };
