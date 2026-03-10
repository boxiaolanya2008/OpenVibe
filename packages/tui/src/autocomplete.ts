import { spawnSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join } from "path";
import { fuzzyFilter } from "./fuzzy.js";

const PATH_DELIMITERS = new Set([" ", "\t", '"', "'", "="]);
function findLastDelimiter(text: string): number {
	for (let i = text.length - 1; i >= 0; i -= 1) {
		if (PATH_DELIMITERS.has(text[i] ?? "")) {
			return i;
		}
	}
	return -1;
}
function findUnclosedQuoteStart(text: string): number | null {
	let inQuotes = false;
	let quoteStart = -1;
	for (let i = 0; i < text.length; i += 1) {
		if (text[i] === '"') {
			inQuotes = !inQuotes;
			if (inQuotes) {
				quoteStart = i;
			}
		}
	}
	return inQuotes ? quoteStart : null;
}
function isTokenStart(text: string, index: number): boolean {
	return index === 0 || PATH_DELIMITERS.has(text[index - 1] ?? "");
}
function extractQuotedPrefix(text: string): string | null {
	const quoteStart = findUnclosedQuoteStart(text);
	if (quoteStart === null) {
		return null;
	}
	if (quoteStart > 0 && text[quoteStart - 1] === "@") {
		if (!isTokenStart(text, quoteStart - 1)) {
			return null;
		}
		return text.slice(quoteStart - 1);
	}
	if (!isTokenStart(text, quoteStart)) {
		return null;
	}
	return text.slice(quoteStart);
}
function parsePathPrefix(prefix: string): { rawPrefix: string; isAtPrefix: boolean; isQuotedPrefix: boolean } {
	if (prefix.startsWith('@"')) {
		return { rawPrefix: prefix.slice(2), isAtPrefix: true, isQuotedPrefix: true };
	}
	if (prefix.startsWith('"')) {
		return { rawPrefix: prefix.slice(1), isAtPrefix: false, isQuotedPrefix: true };
	}
	if (prefix.startsWith("@")) {
		return { rawPrefix: prefix.slice(1), isAtPrefix: true, isQuotedPrefix: false };
	}
	return { rawPrefix: prefix, isAtPrefix: false, isQuotedPrefix: false };
}
function buildCompletionValue(
	path: string,
	options: { isDirectory: boolean; isAtPrefix: boolean; isQuotedPrefix: boolean },
): string {
	const needsQuotes = options.isQuotedPrefix || path.includes(" ");
	const prefix = options.isAtPrefix ? "@" : "";
	if (!needsQuotes) {
		return `${prefix}${path}`;
	}
	const openQuote = `${prefix}"`;
	const closeQuote = '"';
	return `${openQuote}${path}${closeQuote}`;
}
function walkDirectoryWithFd(
	baseDir: string,
	fdPath: string,
	query: string,
	maxResults: number,
): Array<{ path: string; isDirectory: boolean }> {
	const args = [
		"--base-directory",
		baseDir,
		"--max-results",
		String(maxResults),
		"--type",
		"f",
		"--type",
		"d",
		"--full-path",
		"--hidden",
		"--exclude",
		".git",
		"--exclude",
		".git/*",
		"--exclude",
		".git/**",
	];
	if (query) {
		args.push(query);
	}
	const result = spawnSync(fdPath, args, {
		encoding: "utf-8",
		stdio: ["pipe", "pipe", "pipe"],
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.status !== 0 || !result.stdout) {
		return [];
	}
	const lines = result.stdout.trim().split("\n").filter(Boolean);
	const results: Array<{ path: string; isDirectory: boolean }> = [];
	for (const line of lines) {
		const normalizedPath = line.endsWith("/") ? line.slice(0, -1) : line;
		if (normalizedPath === ".git" || normalizedPath.startsWith(".git/") || normalizedPath.includes("/.git/")) {
			continue;
		}
		const isDirectory = line.endsWith("/");
		results.push({
			path: line,
			isDirectory,
		});
	}
	return results;
}
export interface AutocompleteItem {
	value: string;
	label: string;
	description?: string;
}
export interface SlashCommand {
	name: string;
	description?: string;
	getArgumentCompletions?(argumentPrefix: string): AutocompleteItem[] | null;
}
export interface AutocompleteProvider {
	getSuggestions(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
	): {
		items: AutocompleteItem[];
		prefix: string;
	} | null;
	applyCompletion(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		item: AutocompleteItem,
		prefix: string,
	): {
		lines: string[];
		cursorLine: number;
		cursorCol: number;
	};
}
export class CombinedAutocompleteProvider implements AutocompleteProvider {
	private commands: (SlashCommand | AutocompleteItem)[];
	private basePath: string;
	private fdPath: string | null;
	constructor(
		commands: (SlashCommand | AutocompleteItem)[] = [],
		basePath: string = process.cwd(),
		fdPath: string | null = null,
	) {
		this.commands = commands;
		this.basePath = basePath;
		this.fdPath = fdPath;
	}
	getSuggestions(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
	): { items: AutocompleteItem[]; prefix: string } | null {
		const currentLine = lines[cursorLine] || "";
		const textBeforeCursor = currentLine.slice(0, cursorCol);
		const atPrefix = this.extractAtPrefix(textBeforeCursor);
		if (atPrefix) {
			const { rawPrefix, isQuotedPrefix } = parsePathPrefix(atPrefix);
			const suggestions = this.getFuzzyFileSuggestions(rawPrefix, { isQuotedPrefix: isQuotedPrefix });
			if (suggestions.length === 0) return null;
			return {
				items: suggestions,
				prefix: atPrefix,
			};
		}
		if (textBeforeCursor.startsWith("/")) {
			const spaceIndex = textBeforeCursor.indexOf(" ");
			if (spaceIndex === -1) {
				const prefix = textBeforeCursor.slice(1);
				const commandItems = this.commands.map((cmd) => ({
					name: "name" in cmd ? cmd.name : cmd.value,
					label: "name" in cmd ? cmd.name : cmd.label,
					description: cmd.description,
				}));
				const filtered = fuzzyFilter(commandItems, prefix, (item) => item.name).map((item) => ({
					value: item.name,
					label: item.label,
					...(item.description && { description: item.description }),
				}));
				if (filtered.length === 0) return null;
				return {
					items: filtered,
					prefix: textBeforeCursor,
				};
			} else {
				const commandName = textBeforeCursor.slice(1, spaceIndex);
				const argumentText = textBeforeCursor.slice(spaceIndex + 1);
				const command = this.commands.find((cmd) => {
					const name = "name" in cmd ? cmd.name : cmd.value;
					return name === commandName;
				});
				if (!command || !("getArgumentCompletions" in command) || !command.getArgumentCompletions) {
					return null;
				}
				const argumentSuggestions = command.getArgumentCompletions(argumentText);
				if (!argumentSuggestions || argumentSuggestions.length === 0) {
					return null;
				}
				return {
					items: argumentSuggestions,
					prefix: argumentText,
				};
			}
		}
		const pathMatch = this.extractPathPrefix(textBeforeCursor, false);
		if (pathMatch !== null) {
			const suggestions = this.getFileSuggestions(pathMatch);
			if (suggestions.length === 0) return null;
			if (suggestions.length === 1 && suggestions[0]?.value === pathMatch && !pathMatch.endsWith("/")) {
				return {
					items: suggestions,
					prefix: pathMatch,
				};
			}
			return {
				items: suggestions,
				prefix: pathMatch,
			};
		}
		return null;
	}
	applyCompletion(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		item: AutocompleteItem,
		prefix: string,
	): { lines: string[]; cursorLine: number; cursorCol: number } {
		const currentLine = lines[cursorLine] || "";
		const beforePrefix = currentLine.slice(0, cursorCol - prefix.length);
		const afterCursor = currentLine.slice(cursorCol);
		const isQuotedPrefix = prefix.startsWith('"') || prefix.startsWith('@"');
		const hasLeadingQuoteAfterCursor = afterCursor.startsWith('"');
		const hasTrailingQuoteInItem = item.value.endsWith('"');
		const adjustedAfterCursor =
			isQuotedPrefix && hasTrailingQuoteInItem && hasLeadingQuoteAfterCursor ? afterCursor.slice(1) : afterCursor;
		const isSlashCommand = prefix.startsWith("/") && beforePrefix.trim() === "" && !prefix.slice(1).includes("/");
		if (isSlashCommand) {
			const newLine = `${beforePrefix}/${item.value} ${adjustedAfterCursor}`;
			const newLines = [...lines];
			newLines[cursorLine] = newLine;
			return {
				lines: newLines,
				cursorLine,
				cursorCol: beforePrefix.length + item.value.length + 2,
			};
		}
		if (prefix.startsWith("@")) {
			const isDirectory = item.label.endsWith("/");
			const suffix = isDirectory ? "" : " ";
			const newLine = `${beforePrefix + item.value}${suffix}${adjustedAfterCursor}`;
			const newLines = [...lines];
			newLines[cursorLine] = newLine;
			const hasTrailingQuote = item.value.endsWith('"');
			const cursorOffset = isDirectory && hasTrailingQuote ? item.value.length - 1 : item.value.length;
			return {
				lines: newLines,
				cursorLine,
				cursorCol: beforePrefix.length + cursorOffset + suffix.length,
			};
		}
		const textBeforeCursor = currentLine.slice(0, cursorCol);
		if (textBeforeCursor.includes("/") && textBeforeCursor.includes(" ")) {
			const newLine = beforePrefix + item.value + adjustedAfterCursor;
			const newLines = [...lines];
			newLines[cursorLine] = newLine;
			const isDirectory = item.label.endsWith("/");
			const hasTrailingQuote = item.value.endsWith('"');
			const cursorOffset = isDirectory && hasTrailingQuote ? item.value.length - 1 : item.value.length;
			return {
				lines: newLines,
				cursorLine,
				cursorCol: beforePrefix.length + cursorOffset,
			};
		}
		const newLine = beforePrefix + item.value + adjustedAfterCursor;
		const newLines = [...lines];
		newLines[cursorLine] = newLine;
		const isDirectory = item.label.endsWith("/");
		const hasTrailingQuote = item.value.endsWith('"');
		const cursorOffset = isDirectory && hasTrailingQuote ? item.value.length - 1 : item.value.length;
		return {
			lines: newLines,
			cursorLine,
			cursorCol: beforePrefix.length + cursorOffset,
		};
	}
	private extractAtPrefix(text: string): string | null {
		const quotedPrefix = extractQuotedPrefix(text);
		if (quotedPrefix?.startsWith('@"')) {
			return quotedPrefix;
		}
		const lastDelimiterIndex = findLastDelimiter(text);
		const tokenStart = lastDelimiterIndex === -1 ? 0 : lastDelimiterIndex + 1;
		if (text[tokenStart] === "@") {
			return text.slice(tokenStart);
		}
		return null;
	}
	private extractPathPrefix(text: string, forceExtract: boolean = false): string | null {
		const quotedPrefix = extractQuotedPrefix(text);
		if (quotedPrefix) {
			return quotedPrefix;
		}
		const lastDelimiterIndex = findLastDelimiter(text);
		const pathPrefix = lastDelimiterIndex === -1 ? text : text.slice(lastDelimiterIndex + 1);
		if (forceExtract) {
			return pathPrefix;
		}
		if (pathPrefix.includes("/") || pathPrefix.startsWith(".") || pathPrefix.startsWith("~/")) {
			return pathPrefix;
		}
		if (pathPrefix === "" && text.endsWith(" ")) {
			return pathPrefix;
		}
		return null;
	}
	private expandHomePath(path: string): string {
		if (path.startsWith("~/")) {
			const expandedPath = join(homedir(), path.slice(2));
			return path.endsWith("/") && !expandedPath.endsWith("/") ? `${expandedPath}/` : expandedPath;
		} else if (path === "~") {
			return homedir();
		}
		return path;
	}
	private resolveScopedFuzzyQuery(rawQuery: string): { baseDir: string; query: string; displayBase: string } | null {
		const slashIndex = rawQuery.lastIndexOf("/");
		if (slashIndex === -1) {
			return null;
		}
		const displayBase = rawQuery.slice(0, slashIndex + 1);
		const query = rawQuery.slice(slashIndex + 1);
		let baseDir: string;
		if (displayBase.startsWith("~/")) {
			baseDir = this.expandHomePath(displayBase);
		} else if (displayBase.startsWith("/")) {
			baseDir = displayBase;
		} else {
			baseDir = join(this.basePath, displayBase);
		}
		try {
			if (!statSync(baseDir).isDirectory()) {
				return null;
			}
		} catch {
			return null;
		}
		return { baseDir, query, displayBase };
	}
	private scopedPathForDisplay(displayBase: string, relativePath: string): string {
		if (displayBase === "/") {
			return `/${relativePath}`;
		}
		return `${displayBase}${relativePath}`;
	}
	private getFileSuggestions(prefix: string): AutocompleteItem[] {
		try {
			let searchDir: string;
			let searchPrefix: string;
			const { rawPrefix, isAtPrefix, isQuotedPrefix } = parsePathPrefix(prefix);
			let expandedPrefix = rawPrefix;
			if (expandedPrefix.startsWith("~")) {
				expandedPrefix = this.expandHomePath(expandedPrefix);
			}
			const isRootPrefix =
				rawPrefix === "" ||
				rawPrefix === "./" ||
				rawPrefix === "../" ||
				rawPrefix === "~" ||
				rawPrefix === "~/" ||
				rawPrefix === "/" ||
				(isAtPrefix && rawPrefix === "");
			if (isRootPrefix) {
				if (rawPrefix.startsWith("~") || expandedPrefix.startsWith("/")) {
					searchDir = expandedPrefix;
				} else {
					searchDir = join(this.basePath, expandedPrefix);
				}
				searchPrefix = "";
			} else if (rawPrefix.endsWith("/")) {
				if (rawPrefix.startsWith("~") || expandedPrefix.startsWith("/")) {
					searchDir = expandedPrefix;
				} else {
					searchDir = join(this.basePath, expandedPrefix);
				}
				searchPrefix = "";
			} else {
				const dir = dirname(expandedPrefix);
				const file = basename(expandedPrefix);
				if (rawPrefix.startsWith("~") || expandedPrefix.startsWith("/")) {
					searchDir = dir;
				} else {
					searchDir = join(this.basePath, dir);
				}
				searchPrefix = file;
			}
			const entries = readdirSync(searchDir, { withFileTypes: true });
			const suggestions: AutocompleteItem[] = [];
			for (const entry of entries) {
				if (!entry.name.toLowerCase().startsWith(searchPrefix.toLowerCase())) {
					continue;
				}
				let isDirectory = entry.isDirectory();
				if (!isDirectory && entry.isSymbolicLink()) {
					try {
						const fullPath = join(searchDir, entry.name);
						isDirectory = statSync(fullPath).isDirectory();
					} catch {}
				}
				let relativePath: string;
				const name = entry.name;
				const displayPrefix = rawPrefix;
				if (displayPrefix.endsWith("/")) {
					relativePath = displayPrefix + name;
				} else if (displayPrefix.includes("/")) {
					if (displayPrefix.startsWith("~/")) {
						const homeRelativeDir = displayPrefix.slice(2);
						const dir = dirname(homeRelativeDir);
						relativePath = `~/${dir === "." ? name : join(dir, name)}`;
					} else if (displayPrefix.startsWith("/")) {
						const dir = dirname(displayPrefix);
						if (dir === "/") {
							relativePath = `/${name}`;
						} else {
							relativePath = `${dir}/${name}`;
						}
					} else {
						relativePath = join(dirname(displayPrefix), name);
					}
				} else {
					if (displayPrefix.startsWith("~")) {
						relativePath = `~/${name}`;
					} else {
						relativePath = name;
					}
				}
				const pathValue = isDirectory ? `${relativePath}/` : relativePath;
				const value = buildCompletionValue(pathValue, {
					isDirectory,
					isAtPrefix,
					isQuotedPrefix,
				});
				suggestions.push({
					value,
					label: name + (isDirectory ? "/" : ""),
				});
			}
			suggestions.sort((a, b) => {
				const aIsDir = a.value.endsWith("/");
				const bIsDir = b.value.endsWith("/");
				if (aIsDir && !bIsDir) return -1;
				if (!aIsDir && bIsDir) return 1;
				return a.label.localeCompare(b.label);
			});
			return suggestions;
		} catch (_e) {
			return [];
		}
	}
	private scoreEntry(filePath: string, query: string, isDirectory: boolean): number {
		const fileName = basename(filePath);
		const lowerFileName = fileName.toLowerCase();
		const lowerQuery = query.toLowerCase();
		let score = 0;
		if (lowerFileName === lowerQuery) score = 100;
		else if (lowerFileName.startsWith(lowerQuery)) score = 80;
		else if (lowerFileName.includes(lowerQuery)) score = 50;
		else if (filePath.toLowerCase().includes(lowerQuery)) score = 30;
		if (isDirectory && score > 0) score += 10;
		return score;
	}
	private getFuzzyFileSuggestions(query: string, options: { isQuotedPrefix: boolean }): AutocompleteItem[] {
		if (!this.fdPath) {
			return [];
		}
		try {
			const scopedQuery = this.resolveScopedFuzzyQuery(query);
			const fdBaseDir = scopedQuery?.baseDir ?? this.basePath;
			const fdQuery = scopedQuery?.query ?? query;
			const entries = walkDirectoryWithFd(fdBaseDir, this.fdPath, fdQuery, 100);
			const scoredEntries = entries
				.map((entry) => ({
					...entry,
					score: fdQuery ? this.scoreEntry(entry.path, fdQuery, entry.isDirectory) : 1,
				}))
				.filter((entry) => entry.score > 0);
			scoredEntries.sort((a, b) => b.score - a.score);
			const topEntries = scoredEntries.slice(0, 20);
			const suggestions: AutocompleteItem[] = [];
			for (const { path: entryPath, isDirectory } of topEntries) {
				const pathWithoutSlash = isDirectory ? entryPath.slice(0, -1) : entryPath;
				const displayPath = scopedQuery
					? this.scopedPathForDisplay(scopedQuery.displayBase, pathWithoutSlash)
					: pathWithoutSlash;
				const entryName = basename(pathWithoutSlash);
				const completionPath = isDirectory ? `${displayPath}/` : displayPath;
				const value = buildCompletionValue(completionPath, {
					isDirectory,
					isAtPrefix: true,
					isQuotedPrefix: options.isQuotedPrefix,
				});
				suggestions.push({
					value,
					label: entryName + (isDirectory ? "/" : ""),
					description: displayPath,
				});
			}
			return suggestions;
		} catch {
			return [];
		}
	}
	getForceFileSuggestions(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
	): { items: AutocompleteItem[]; prefix: string } | null {
		const currentLine = lines[cursorLine] || "";
		const textBeforeCursor = currentLine.slice(0, cursorCol);
		if (textBeforeCursor.trim().startsWith("/") && !textBeforeCursor.trim().includes(" ")) {
			return null;
		}
		const pathMatch = this.extractPathPrefix(textBeforeCursor, true);
		if (pathMatch !== null) {
			const suggestions = this.getFileSuggestions(pathMatch);
			if (suggestions.length === 0) return null;
			return {
				items: suggestions,
				prefix: pathMatch,
			};
		}
		return null;
	}
	shouldTriggerFileCompletion(lines: string[], cursorLine: number, cursorCol: number): boolean {
		const currentLine = lines[cursorLine] || "";
		const textBeforeCursor = currentLine.slice(0, cursorCol);
		if (textBeforeCursor.trim().startsWith("/") && !textBeforeCursor.trim().includes(" ")) {
			return false;
		}
		return true;
	}
}
