import type { AgentTool, AgentToolResult } from "@boxiaolanya2008/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import { existsSync } from "fs";
import { globSync } from "glob";
import { resolveToCwd } from "./path-utils.js";

const findSchema = Type.Object({
	pattern: Type.String({
		description: "Glob pattern to match files, e.g. '*.ts', '**/*.json'",
	}),
	path: Type.Optional(
		Type.String({
			description: "Optional directory path to search in. Defaults to current working directory.",
		}),
	),
});

export type FindToolInput = Static<typeof findSchema>;

export interface FindToolDetails {
	fileCount?: number;
}

export interface FindOperations {
	glob: (pattern: string, options: { cwd: string; dot: boolean; absolute: boolean; ignore: string[] }) => string[];
}

const defaultFindOperations: FindOperations = {
	glob: (pattern, options) => globSync(pattern, options),
};

export interface FindToolOptions {
	operations?: FindOperations;
}

export function createFindTool(cwd: string, options?: FindToolOptions): AgentTool<typeof findSchema> {
	const customOps = options?.operations;
	return {
		name: "find",
		label: "find",
		description: "Find files matching a glob pattern",
		parameters: findSchema,
		execute: async (
			_toolCallId: string,
			{ pattern, path: searchPath }: { pattern: string; path?: string },
			signal?: AbortSignal,
		): Promise<AgentToolResult<FindToolDetails>> => {
			if (signal?.aborted) {
				throw new Error("Operation aborted");
			}
			const ops = customOps ?? defaultFindOperations;
			const searchDir = searchPath ? resolveToCwd(searchPath, cwd) : cwd;
			if (!existsSync(searchDir)) {
				return {
					content: [{ type: "text", text: `Error: Path does not exist: ${searchDir}` }],
					details: {},
				};
			}
			const results = ops.glob(pattern, {
				cwd: searchDir,
				dot: true,
				absolute: true,
				ignore: ["**/node_modules/**", "**/.git/**"],
			});
			const output = results.join("\n") || "No files found";
			return {
				content: [{ type: "text", text: output }],
				details: { fileCount: results.length },
			};
		},
	};
}

export const findTool = createFindTool(process.cwd());
