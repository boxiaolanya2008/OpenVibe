import { randomBytes } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ChildProcess, spawn } from "child_process";
import stripAnsi from "strip-ansi";
import { getShellConfig, getShellEnv, killProcessTree, sanitizeBinaryOutput } from "../utils/shell.js";
import type { BashOperations } from "./tools/bash.js";
import { DEFAULT_MAX_BYTES, truncateTail } from "./tools/truncate.js";
export interface BashExecutorOptions {
	onChunk?: (chunk: string) => void;
	signal?: AbortSignal;
}
export interface BashResult {
	output: string;
	exitCode: number | undefined;
	cancelled: boolean;
	truncated: boolean;
	fullOutputPath?: string;
}
export function executeBash(command: string, options?: BashExecutorOptions): Promise<BashResult> {
	return new Promise((resolve, reject) => {
		const { shell, args } = getShellConfig();
		const child: ChildProcess = spawn(shell, [...args, command], {
			detached: true,
			env: getShellEnv(),
			stdio: ["ignore", "pipe", "pipe"],
		});
		const outputChunks: string[] = [];
		let outputBytes = 0;
		const maxOutputBytes = DEFAULT_MAX_BYTES * 2;
		let tempFilePath: string | undefined;
		let tempFileStream: WriteStream | undefined;
		let totalBytes = 0;
		const abortHandler = () => {
			if (child.pid) {
				killProcessTree(child.pid);
			}
		};
		if (options?.signal) {
			if (options.signal.aborted) {
				child.kill();
				resolve({
					output: "",
					exitCode: undefined,
					cancelled: true,
					truncated: false,
				});
				return;
			}
			options.signal.addEventListener("abort", abortHandler, { once: true });
		}
		const decoder = new TextDecoder();
		const handleData = (data: Buffer) => {
			totalBytes += data.length;
			const text = sanitizeBinaryOutput(stripAnsi(decoder.decode(data, { stream: true }))).replace(/\r/g, "");
			if (totalBytes > DEFAULT_MAX_BYTES && !tempFilePath) {
				const id = randomBytes(8).toString("hex");
				tempFilePath = join(tmpdir(), `pi-bash-${id}.log`);
				tempFileStream = createWriteStream(tempFilePath);
				for (const chunk of outputChunks) {
					tempFileStream.write(chunk);
				}
			}
			if (tempFileStream) {
				tempFileStream.write(text);
			}
			outputChunks.push(text);
			outputBytes += text.length;
			while (outputBytes > maxOutputBytes && outputChunks.length > 1) {
				const removed = outputChunks.shift()!;
				outputBytes -= removed.length;
			}
			if (options?.onChunk) {
				options.onChunk(text);
			}
		};
		child.stdout?.on("data", handleData);
		child.stderr?.on("data", handleData);
		child.on("close", (code) => {
			if (options?.signal) {
				options.signal.removeEventListener("abort", abortHandler);
			}
			if (tempFileStream) {
				tempFileStream.end();
			}
			const fullOutput = outputChunks.join("");
			const truncationResult = truncateTail(fullOutput);
			const cancelled = code === null;
			resolve({
				output: truncationResult.truncated ? truncationResult.content : fullOutput,
				exitCode: cancelled ? undefined : code,
				cancelled,
				truncated: truncationResult.truncated,
				fullOutputPath: tempFilePath,
			});
		});
		child.on("error", (err) => {
			if (options?.signal) {
				options.signal.removeEventListener("abort", abortHandler);
			}
			if (tempFileStream) {
				tempFileStream.end();
			}
			reject(err);
		});
	});
}
export async function executeBashWithOperations(
	command: string,
	cwd: string,
	operations: BashOperations,
	options?: BashExecutorOptions,
): Promise<BashResult> {
	const outputChunks: string[] = [];
	let outputBytes = 0;
	const maxOutputBytes = DEFAULT_MAX_BYTES * 2;
	let tempFilePath: string | undefined;
	let tempFileStream: WriteStream | undefined;
	let totalBytes = 0;
	const decoder = new TextDecoder();
	const onData = (data: Buffer) => {
		totalBytes += data.length;
		const text = sanitizeBinaryOutput(stripAnsi(decoder.decode(data, { stream: true }))).replace(/\r/g, "");
		if (totalBytes > DEFAULT_MAX_BYTES && !tempFilePath) {
			const id = randomBytes(8).toString("hex");
			tempFilePath = join(tmpdir(), `pi-bash-${id}.log`);
			tempFileStream = createWriteStream(tempFilePath);
			for (const chunk of outputChunks) {
				tempFileStream.write(chunk);
			}
		}
		if (tempFileStream) {
			tempFileStream.write(text);
		}
		outputChunks.push(text);
		outputBytes += text.length;
		while (outputBytes > maxOutputBytes && outputChunks.length > 1) {
			const removed = outputChunks.shift()!;
			outputBytes -= removed.length;
		}
		if (options?.onChunk) {
			options.onChunk(text);
		}
	};
	try {
		const result = await operations.exec(command, cwd, {
			onData,
			signal: options?.signal,
		});
		if (tempFileStream) {
			tempFileStream.end();
		}
		const fullOutput = outputChunks.join("");
		const truncationResult = truncateTail(fullOutput);
		const cancelled = options?.signal?.aborted ?? false;
		return {
			output: truncationResult.truncated ? truncationResult.content : fullOutput,
			exitCode: cancelled ? undefined : (result.exitCode ?? undefined),
			cancelled,
			truncated: truncationResult.truncated,
			fullOutputPath: tempFilePath,
		};
	} catch (err) {
		if (tempFileStream) {
			tempFileStream.end();
		}
		if (options?.signal?.aborted) {
			const fullOutput = outputChunks.join("");
			const truncationResult = truncateTail(fullOutput);
			return {
				output: truncationResult.truncated ? truncationResult.content : fullOutput,
				exitCode: undefined,
				cancelled: true,
				truncated: truncationResult.truncated,
				fullOutputPath: tempFilePath,
			};
		}
		throw err;
	}
}
