import { eastAsianWidth } from "get-east-asian-width";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function getSegmenter(): Intl.Segmenter {
	return segmenter;
}
function couldBeEmoji(segment: string): boolean {
	const cp = segment.codePointAt(0)!;
	return (
		(cp >= 0x1f000 && cp <= 0x1fbff) ||
		(cp >= 0x2300 && cp <= 0x23ff) ||
		(cp >= 0x2600 && cp <= 0x27bf) ||
		(cp >= 0x2b50 && cp <= 0x2b55) ||
		segment.includes("\uFE0F") ||
		segment.length > 2
	);
}
const zeroWidthRegex = /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Mark}|\p{Surrogate})+$/v;
const leadingNonPrintingRegex = /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Mark}\p{Surrogate}]+/v;
const rgiEmojiRegex = /^\p{RGI_Emoji}$/v;
const WIDTH_CACHE_SIZE = 512;
const widthCache = new Map<string, number>();
function graphemeWidth(segment: string): number {
	if (zeroWidthRegex.test(segment)) {
		return 0;
	}
	if (couldBeEmoji(segment) && rgiEmojiRegex.test(segment)) {
		return 2;
	}
	const base = segment.replace(leadingNonPrintingRegex, "");
	const cp = base.codePointAt(0);
	if (cp === undefined) {
		return 0;
	}
	if (cp >= 0x1f1e6 && cp <= 0x1f1ff) {
		return 2;
	}
	let width = eastAsianWidth(cp);
	if (segment.length > 1) {
		for (const char of segment.slice(1)) {
			const c = char.codePointAt(0)!;
			if (c >= 0xff00 && c <= 0xffef) {
				width += eastAsianWidth(c);
			}
		}
	}
	return width;
}
export function visibleWidth(str: string): number {
	if (str.length === 0) {
		return 0;
	}
	let isPureAscii = true;
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		if (code < 0x20 || code > 0x7e) {
			isPureAscii = false;
			break;
		}
	}
	if (isPureAscii) {
		return str.length;
	}
	const cached = widthCache.get(str);
	if (cached !== undefined) {
		return cached;
	}
	let clean = str;
	if (str.includes("\t")) {
		clean = clean.replace(/\t/g, "   ");
	}
	if (clean.includes("\x1b")) {
		let stripped = "";
		let i = 0;
		while (i < clean.length) {
			const ansi = extractAnsiCode(clean, i);
			if (ansi) {
				i += ansi.length;
				continue;
			}
			stripped += clean[i];
			i++;
		}
		clean = stripped;
	}
	let width = 0;
	for (const { segment } of segmenter.segment(clean)) {
		width += graphemeWidth(segment);
	}
	if (widthCache.size >= WIDTH_CACHE_SIZE) {
		const firstKey = widthCache.keys().next().value;
		if (firstKey !== undefined) {
			widthCache.delete(firstKey);
		}
	}
	widthCache.set(str, width);
	return width;
}
export function extractAnsiCode(str: string, pos: number): { code: string; length: number } | null {
	if (pos >= str.length || str[pos] !== "\x1b") return null;
	const next = str[pos + 1];
	if (next === "[") {
		let j = pos + 2;
		while (j < str.length && !/[mGKHJ]/.test(str[j]!)) j++;
		if (j < str.length) return { code: str.substring(pos, j + 1), length: j + 1 - pos };
		return null;
	}
	if (next === "]") {
		let j = pos + 2;
		while (j < str.length) {
			if (str[j] === "\x07") return { code: str.substring(pos, j + 1), length: j + 1 - pos };
			if (str[j] === "\x1b" && str[j + 1] === "\\") return { code: str.substring(pos, j + 2), length: j + 2 - pos };
			j++;
		}
		return null;
	}
	if (next === "_") {
		let j = pos + 2;
		while (j < str.length) {
			if (str[j] === "\x07") return { code: str.substring(pos, j + 1), length: j + 1 - pos };
			if (str[j] === "\x1b" && str[j + 1] === "\\") return { code: str.substring(pos, j + 2), length: j + 2 - pos };
			j++;
		}
		return null;
	}
	return null;
}
class AnsiCodeTracker {
	private bold = false;
	private dim = false;
	private italic = false;
	private underline = false;
	private blink = false;
	private inverse = false;
	private hidden = false;
	private strikethrough = false;
	private fgColor: string | null = null;
	private bgColor: string | null = null;
	process(ansiCode: string): void {
		if (!ansiCode.endsWith("m")) {
			return;
		}
		const match = ansiCode.match(/\x1b\[([\d;]*)m/);
		if (!match) return;
		const params = match[1];
		if (params === "" || params === "0") {
			this.reset();
			return;
		}
		const parts = params.split(";");
		let i = 0;
		while (i < parts.length) {
			const code = Number.parseInt(parts[i], 10);
			if (code === 38 || code === 48) {
				if (parts[i + 1] === "5" && parts[i + 2] !== undefined) {
					const colorCode = `${parts[i]};${parts[i + 1]};${parts[i + 2]}`;
					if (code === 38) {
						this.fgColor = colorCode;
					} else {
						this.bgColor = colorCode;
					}
					i += 3;
					continue;
				} else if (parts[i + 1] === "2" && parts[i + 4] !== undefined) {
					const colorCode = `${parts[i]};${parts[i + 1]};${parts[i + 2]};${parts[i + 3]};${parts[i + 4]}`;
					if (code === 38) {
						this.fgColor = colorCode;
					} else {
						this.bgColor = colorCode;
					}
					i += 5;
					continue;
				}
			}
			switch (code) {
				case 0:
					this.reset();
					break;
				case 1:
					this.bold = true;
					break;
				case 2:
					this.dim = true;
					break;
				case 3:
					this.italic = true;
					break;
				case 4:
					this.underline = true;
					break;
				case 5:
					this.blink = true;
					break;
				case 7:
					this.inverse = true;
					break;
				case 8:
					this.hidden = true;
					break;
				case 9:
					this.strikethrough = true;
					break;
				case 21:
					this.bold = false;
					break;
				case 22:
					this.bold = false;
					this.dim = false;
					break;
				case 23:
					this.italic = false;
					break;
				case 24:
					this.underline = false;
					break;
				case 25:
					this.blink = false;
					break;
				case 27:
					this.inverse = false;
					break;
				case 28:
					this.hidden = false;
					break;
				case 29:
					this.strikethrough = false;
					break;
				case 39:
					this.fgColor = null;
					break;
				case 49:
					this.bgColor = null;
					break;
				default:
					if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
						this.fgColor = String(code);
					} else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
						this.bgColor = String(code);
					}
					break;
			}
			i++;
		}
	}
	private reset(): void {
		this.bold = false;
		this.dim = false;
		this.italic = false;
		this.underline = false;
		this.blink = false;
		this.inverse = false;
		this.hidden = false;
		this.strikethrough = false;
		this.fgColor = null;
		this.bgColor = null;
	}
	clear(): void {
		this.reset();
	}
	getActiveCodes(): string {
		const codes: string[] = [];
		if (this.bold) codes.push("1");
		if (this.dim) codes.push("2");
		if (this.italic) codes.push("3");
		if (this.underline) codes.push("4");
		if (this.blink) codes.push("5");
		if (this.inverse) codes.push("7");
		if (this.hidden) codes.push("8");
		if (this.strikethrough) codes.push("9");
		if (this.fgColor) codes.push(this.fgColor);
		if (this.bgColor) codes.push(this.bgColor);
		if (codes.length === 0) return "";
		return `\x1b[${codes.join(";")}m`;
	}
	hasActiveCodes(): boolean {
		return (
			this.bold ||
			this.dim ||
			this.italic ||
			this.underline ||
			this.blink ||
			this.inverse ||
			this.hidden ||
			this.strikethrough ||
			this.fgColor !== null ||
			this.bgColor !== null
		);
	}
	getLineEndReset(): string {
		if (this.underline) {
			return "\x1b[24m";
		}
		return "";
	}
}
function updateTrackerFromText(text: string, tracker: AnsiCodeTracker): void {
	let i = 0;
	while (i < text.length) {
		const ansiResult = extractAnsiCode(text, i);
		if (ansiResult) {
			tracker.process(ansiResult.code);
			i += ansiResult.length;
		} else {
			i++;
		}
	}
}
function splitIntoTokensWithAnsi(text: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let pendingAnsi = "";
	let inWhitespace = false;
	let i = 0;
	while (i < text.length) {
		const ansiResult = extractAnsiCode(text, i);
		if (ansiResult) {
			pendingAnsi += ansiResult.code;
			i += ansiResult.length;
			continue;
		}
		const char = text[i];
		const charIsSpace = char === " ";
		if (charIsSpace !== inWhitespace && current) {
			tokens.push(current);
			current = "";
		}
		if (pendingAnsi) {
			current += pendingAnsi;
			pendingAnsi = "";
		}
		inWhitespace = charIsSpace;
		current += char;
		i++;
	}
	if (pendingAnsi) {
		current += pendingAnsi;
	}
	if (current) {
		tokens.push(current);
	}
	return tokens;
}
export function wrapTextWithAnsi(text: string, width: number): string[] {
	if (!text) {
		return [""];
	}
	const inputLines = text.split("\n");
	const result: string[] = [];
	const tracker = new AnsiCodeTracker();
	for (const inputLine of inputLines) {
		const prefix = result.length > 0 ? tracker.getActiveCodes() : "";
		result.push(...wrapSingleLine(prefix + inputLine, width));
		updateTrackerFromText(inputLine, tracker);
	}
	return result.length > 0 ? result : [""];
}
function wrapSingleLine(line: string, width: number): string[] {
	if (!line) {
		return [""];
	}
	const visibleLength = visibleWidth(line);
	if (visibleLength <= width) {
		return [line];
	}
	const wrapped: string[] = [];
	const tracker = new AnsiCodeTracker();
	const tokens = splitIntoTokensWithAnsi(line);
	let currentLine = "";
	let currentVisibleLength = 0;
	for (const token of tokens) {
		const tokenVisibleLength = visibleWidth(token);
		const isWhitespace = token.trim() === "";
		if (tokenVisibleLength > width && !isWhitespace) {
			if (currentLine) {
				const lineEndReset = tracker.getLineEndReset();
				if (lineEndReset) {
					currentLine += lineEndReset;
				}
				wrapped.push(currentLine);
				currentLine = "";
				currentVisibleLength = 0;
			}
			const broken = breakLongWord(token, width, tracker);
			wrapped.push(...broken.slice(0, -1));
			currentLine = broken[broken.length - 1];
			currentVisibleLength = visibleWidth(currentLine);
			continue;
		}
		const totalNeeded = currentVisibleLength + tokenVisibleLength;
		if (totalNeeded > width && currentVisibleLength > 0) {
			let lineToWrap = currentLine.trimEnd();
			const lineEndReset = tracker.getLineEndReset();
			if (lineEndReset) {
				lineToWrap += lineEndReset;
			}
			wrapped.push(lineToWrap);
			if (isWhitespace) {
				currentLine = tracker.getActiveCodes();
				currentVisibleLength = 0;
			} else {
				currentLine = tracker.getActiveCodes() + token;
				currentVisibleLength = tokenVisibleLength;
			}
		} else {
			currentLine += token;
			currentVisibleLength += tokenVisibleLength;
		}
		updateTrackerFromText(token, tracker);
	}
	if (currentLine) {
		wrapped.push(currentLine);
	}
	return wrapped.length > 0 ? wrapped.map((line) => line.trimEnd()) : [""];
}
const PUNCTUATION_REGEX = /[(){}[\]<>.,;:'"!?+\-=*/\\|&%^$#@~`]/;
export function isWhitespaceChar(char: string): boolean {
	return /\s/.test(char);
}
export function isPunctuationChar(char: string): boolean {
	return PUNCTUATION_REGEX.test(char);
}
function breakLongWord(word: string, width: number, tracker: AnsiCodeTracker): string[] {
	const lines: string[] = [];
	let currentLine = tracker.getActiveCodes();
	let currentWidth = 0;
	let i = 0;
	const segments: Array<{ type: "ansi" | "grapheme"; value: string }> = [];
	while (i < word.length) {
		const ansiResult = extractAnsiCode(word, i);
		if (ansiResult) {
			segments.push({ type: "ansi", value: ansiResult.code });
			i += ansiResult.length;
		} else {
			let end = i;
			while (end < word.length) {
				const nextAnsi = extractAnsiCode(word, end);
				if (nextAnsi) break;
				end++;
			}
			const textPortion = word.slice(i, end);
			for (const seg of segmenter.segment(textPortion)) {
				segments.push({ type: "grapheme", value: seg.segment });
			}
			i = end;
		}
	}
	for (const seg of segments) {
		if (seg.type === "ansi") {
			currentLine += seg.value;
			tracker.process(seg.value);
			continue;
		}
		const grapheme = seg.value;
		if (!grapheme) continue;
		const graphemeWidth = visibleWidth(grapheme);
		if (currentWidth + graphemeWidth > width) {
			const lineEndReset = tracker.getLineEndReset();
			if (lineEndReset) {
				currentLine += lineEndReset;
			}
			lines.push(currentLine);
			currentLine = tracker.getActiveCodes();
			currentWidth = 0;
		}
		currentLine += grapheme;
		currentWidth += graphemeWidth;
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	return lines.length > 0 ? lines : [""];
}
export function applyBackgroundToLine(line: string, width: number, bgFn: (text: string) => string): string {
	const visibleLen = visibleWidth(line);
	const paddingNeeded = Math.max(0, width - visibleLen);
	const padding = " ".repeat(paddingNeeded);
	const withPadding = line + padding;
	return bgFn(withPadding);
}
export function truncateToWidth(
	text: string,
	maxWidth: number,
	ellipsis: string = "...",
	pad: boolean = false,
): string {
	const textVisibleWidth = visibleWidth(text);
	if (textVisibleWidth <= maxWidth) {
		return pad ? text + " ".repeat(maxWidth - textVisibleWidth) : text;
	}
	const ellipsisWidth = visibleWidth(ellipsis);
	const targetWidth = maxWidth - ellipsisWidth;
	if (targetWidth <= 0) {
		return ellipsis.substring(0, maxWidth);
	}
	let i = 0;
	const segments: Array<{ type: "ansi" | "grapheme"; value: string }> = [];
	while (i < text.length) {
		const ansiResult = extractAnsiCode(text, i);
		if (ansiResult) {
			segments.push({ type: "ansi", value: ansiResult.code });
			i += ansiResult.length;
		} else {
			let end = i;
			while (end < text.length) {
				const nextAnsi = extractAnsiCode(text, end);
				if (nextAnsi) break;
				end++;
			}
			const textPortion = text.slice(i, end);
			for (const seg of segmenter.segment(textPortion)) {
				segments.push({ type: "grapheme", value: seg.segment });
			}
			i = end;
		}
	}
	let result = "";
	let currentWidth = 0;
	for (const seg of segments) {
		if (seg.type === "ansi") {
			result += seg.value;
			continue;
		}
		const grapheme = seg.value;
		if (!grapheme) continue;
		const graphemeWidth = visibleWidth(grapheme);
		if (currentWidth + graphemeWidth > targetWidth) {
			break;
		}
		result += grapheme;
		currentWidth += graphemeWidth;
	}
	const truncated = `${result}\x1b[0m${ellipsis}`;
	if (pad) {
		const truncatedWidth = visibleWidth(truncated);
		return truncated + " ".repeat(Math.max(0, maxWidth - truncatedWidth));
	}
	return truncated;
}
export function sliceByColumn(line: string, startCol: number, length: number, strict = false): string {
	return sliceWithWidth(line, startCol, length, strict).text;
}
export function sliceWithWidth(
	line: string,
	startCol: number,
	length: number,
	strict = false,
): { text: string; width: number } {
	if (length <= 0) return { text: "", width: 0 };
	const endCol = startCol + length;
	let result = "",
		resultWidth = 0,
		currentCol = 0,
		i = 0,
		pendingAnsi = "";
	while (i < line.length) {
		const ansi = extractAnsiCode(line, i);
		if (ansi) {
			if (currentCol >= startCol && currentCol < endCol) result += ansi.code;
			else if (currentCol < startCol) pendingAnsi += ansi.code;
			i += ansi.length;
			continue;
		}
		let textEnd = i;
		while (textEnd < line.length && !extractAnsiCode(line, textEnd)) textEnd++;
		for (const { segment } of segmenter.segment(line.slice(i, textEnd))) {
			const w = graphemeWidth(segment);
			const inRange = currentCol >= startCol && currentCol < endCol;
			const fits = !strict || currentCol + w <= endCol;
			if (inRange && fits) {
				if (pendingAnsi) {
					result += pendingAnsi;
					pendingAnsi = "";
				}
				result += segment;
				resultWidth += w;
			}
			currentCol += w;
			if (currentCol >= endCol) break;
		}
		i = textEnd;
		if (currentCol >= endCol) break;
	}
	return { text: result, width: resultWidth };
}
const pooledStyleTracker = new AnsiCodeTracker();
export function extractSegments(
	line: string,
	beforeEnd: number,
	afterStart: number,
	afterLen: number,
	strictAfter = false,
): { before: string; beforeWidth: number; after: string; afterWidth: number } {
	let before = "",
		beforeWidth = 0,
		after = "",
		afterWidth = 0;
	let currentCol = 0,
		i = 0;
	let pendingAnsiBefore = "";
	let afterStarted = false;
	const afterEnd = afterStart + afterLen;
	pooledStyleTracker.clear();
	while (i < line.length) {
		const ansi = extractAnsiCode(line, i);
		if (ansi) {
			pooledStyleTracker.process(ansi.code);
			if (currentCol < beforeEnd) {
				pendingAnsiBefore += ansi.code;
			} else if (currentCol >= afterStart && currentCol < afterEnd && afterStarted) {
				after += ansi.code;
			}
			i += ansi.length;
			continue;
		}
		let textEnd = i;
		while (textEnd < line.length && !extractAnsiCode(line, textEnd)) textEnd++;
		for (const { segment } of segmenter.segment(line.slice(i, textEnd))) {
			const w = graphemeWidth(segment);
			if (currentCol < beforeEnd) {
				if (pendingAnsiBefore) {
					before += pendingAnsiBefore;
					pendingAnsiBefore = "";
				}
				before += segment;
				beforeWidth += w;
			} else if (currentCol >= afterStart && currentCol < afterEnd) {
				const fits = !strictAfter || currentCol + w <= afterEnd;
				if (fits) {
					if (!afterStarted) {
						after += pooledStyleTracker.getActiveCodes();
						afterStarted = true;
					}
					after += segment;
					afterWidth += w;
				}
			}
			currentCol += w;
			if (afterLen <= 0 ? currentCol >= beforeEnd : currentCol >= afterEnd) break;
		}
		i = textEnd;
		if (afterLen <= 0 ? currentCol >= beforeEnd : currentCol >= afterEnd) break;
	}
	return { before, beforeWidth, after, afterWidth };
}
