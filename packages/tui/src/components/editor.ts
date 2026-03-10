import type { AutocompleteProvider, CombinedAutocompleteProvider } from "../autocomplete.js";
import { getEditorKeybindings } from "../keybindings.js";
import { decodeKittyPrintable, matchesKey } from "../keys.js";
import { KillRing } from "../kill-ring.js";
import { type Component, CURSOR_MARKER, type Focusable, type TUI } from "../tui.js";
import { UndoStack } from "../undo-stack.js";
import { getSegmenter, isPunctuationChar, isWhitespaceChar, visibleWidth } from "../utils.js";
import { SelectList, type SelectListTheme } from "./select-list.js";

const segmenter = getSegmenter();
export interface TextChunk {
	text: string;
	startIndex: number;
	endIndex: number;
}
export function wordWrapLine(line: string, maxWidth: number): TextChunk[] {
	if (!line || maxWidth <= 0) {
		return [{ text: "", startIndex: 0, endIndex: 0 }];
	}
	const lineWidth = visibleWidth(line);
	if (lineWidth <= maxWidth) {
		return [{ text: line, startIndex: 0, endIndex: line.length }];
	}
	const chunks: TextChunk[] = [];
	const segments = [...segmenter.segment(line)];
	let currentWidth = 0;
	let chunkStart = 0;
	let wrapOppIndex = -1;
	let wrapOppWidth = 0;
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i]!;
		const grapheme = seg.segment;
		const gWidth = visibleWidth(grapheme);
		const charIndex = seg.index;
		const isWs = isWhitespaceChar(grapheme);
		if (currentWidth + gWidth > maxWidth) {
			if (wrapOppIndex >= 0) {
				chunks.push({ text: line.slice(chunkStart, wrapOppIndex), startIndex: chunkStart, endIndex: wrapOppIndex });
				chunkStart = wrapOppIndex;
				currentWidth -= wrapOppWidth;
			} else if (chunkStart < charIndex) {
				chunks.push({ text: line.slice(chunkStart, charIndex), startIndex: chunkStart, endIndex: charIndex });
				chunkStart = charIndex;
				currentWidth = 0;
			}
			wrapOppIndex = -1;
		}
		currentWidth += gWidth;
		const next = segments[i + 1];
		if (isWs && next && !isWhitespaceChar(next.segment)) {
			wrapOppIndex = next.index;
			wrapOppWidth = currentWidth;
		}
	}
	chunks.push({ text: line.slice(chunkStart), startIndex: chunkStart, endIndex: line.length });
	return chunks;
}
interface EditorState {
	lines: string[];
	cursorLine: number;
	cursorCol: number;
}
interface LayoutLine {
	text: string;
	hasCursor: boolean;
	cursorPos?: number;
}
export interface EditorTheme {
	borderColor: (str: string) => string;
	selectList: SelectListTheme;
}
export interface EditorOptions {
	paddingX?: number;
	autocompleteMaxVisible?: number;
}
export class Editor implements Component, Focusable {
	private state: EditorState = {
		lines: [""],
		cursorLine: 0,
		cursorCol: 0,
	};
	focused: boolean = false;
	protected tui: TUI;
	private theme: EditorTheme;
	private paddingX: number = 0;
	private lastWidth: number = 80;
	private scrollOffset: number = 0;
	public borderColor: (str: string) => string;
	private autocompleteProvider?: AutocompleteProvider;
	private autocompleteList?: SelectList;
	private autocompleteState: "regular" | "force" | null = null;
	private autocompletePrefix: string = "";
	private autocompleteMaxVisible: number = 5;
	private pastes: Map<number, string> = new Map();
	private pasteCounter: number = 0;
	private pasteBuffer: string = "";
	private isInPaste: boolean = false;
	private history: string[] = [];
	private historyIndex: number = -1;
	private killRing = new KillRing();
	private lastAction: "kill" | "yank" | "type-word" | null = null;
	private jumpMode: "forward" | "backward" | null = null;
	private preferredVisualCol: number | null = null;
	private undoStack = new UndoStack<EditorState>();
	public onSubmit?: (text: string) => void;
	public onChange?: (text: string) => void;
	public disableSubmit: boolean = false;
	constructor(tui: TUI, theme: EditorTheme, options: EditorOptions = {}) {
		this.tui = tui;
		this.theme = theme;
		this.borderColor = theme.borderColor;
		const paddingX = options.paddingX ?? 0;
		this.paddingX = Number.isFinite(paddingX) ? Math.max(0, Math.floor(paddingX)) : 0;
		const maxVisible = options.autocompleteMaxVisible ?? 5;
		this.autocompleteMaxVisible = Number.isFinite(maxVisible) ? Math.max(3, Math.min(20, Math.floor(maxVisible))) : 5;
	}
	getPaddingX(): number {
		return this.paddingX;
	}
	setPaddingX(padding: number): void {
		const newPadding = Number.isFinite(padding) ? Math.max(0, Math.floor(padding)) : 0;
		if (this.paddingX !== newPadding) {
			this.paddingX = newPadding;
			this.tui.requestRender();
		}
	}
	getAutocompleteMaxVisible(): number {
		return this.autocompleteMaxVisible;
	}
	setAutocompleteMaxVisible(maxVisible: number): void {
		const newMaxVisible = Number.isFinite(maxVisible) ? Math.max(3, Math.min(20, Math.floor(maxVisible))) : 5;
		if (this.autocompleteMaxVisible !== newMaxVisible) {
			this.autocompleteMaxVisible = newMaxVisible;
			this.tui.requestRender();
		}
	}
	setAutocompleteProvider(provider: AutocompleteProvider): void {
		this.autocompleteProvider = provider;
	}
	addToHistory(text: string): void {
		const trimmed = text.trim();
		if (!trimmed) return;
		if (this.history.length > 0 && this.history[0] === trimmed) return;
		this.history.unshift(trimmed);
		if (this.history.length > 100) {
			this.history.pop();
		}
	}
	private isEditorEmpty(): boolean {
		return this.state.lines.length === 1 && this.state.lines[0] === "";
	}
	private isOnFirstVisualLine(): boolean {
		const visualLines = this.buildVisualLineMap(this.lastWidth);
		const currentVisualLine = this.findCurrentVisualLine(visualLines);
		return currentVisualLine === 0;
	}
	private isOnLastVisualLine(): boolean {
		const visualLines = this.buildVisualLineMap(this.lastWidth);
		const currentVisualLine = this.findCurrentVisualLine(visualLines);
		return currentVisualLine === visualLines.length - 1;
	}
	private navigateHistory(direction: 1 | -1): void {
		this.lastAction = null;
		if (this.history.length === 0) return;
		const newIndex = this.historyIndex - direction;
		if (newIndex < -1 || newIndex >= this.history.length) return;
		if (this.historyIndex === -1 && newIndex >= 0) {
			this.pushUndoSnapshot();
		}
		this.historyIndex = newIndex;
		if (this.historyIndex === -1) {
			this.setTextInternal("");
		} else {
			this.setTextInternal(this.history[this.historyIndex] || "");
		}
	}
	private setTextInternal(text: string): void {
		const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
		this.state.lines = lines.length === 0 ? [""] : lines;
		this.state.cursorLine = this.state.lines.length - 1;
		this.setCursorCol(this.state.lines[this.state.cursorLine]?.length || 0);
		this.scrollOffset = 0;
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	invalidate(): void {}
	render(width: number): string[] {
		const maxPadding = Math.max(0, Math.floor((width - 1) / 2));
		const paddingX = Math.min(this.paddingX, maxPadding);
		const contentWidth = Math.max(1, width - paddingX * 2);
		const layoutWidth = Math.max(1, contentWidth - (paddingX ? 0 : 1));
		this.lastWidth = layoutWidth;
		const horizontal = this.borderColor("─");
		const layoutLines = this.layoutText(layoutWidth);
		const terminalRows = this.tui.terminal.rows;
		const maxVisibleLines = Math.max(5, Math.floor(terminalRows * 0.3));
		let cursorLineIndex = layoutLines.findIndex((line) => line.hasCursor);
		if (cursorLineIndex === -1) cursorLineIndex = 0;
		if (cursorLineIndex < this.scrollOffset) {
			this.scrollOffset = cursorLineIndex;
		} else if (cursorLineIndex >= this.scrollOffset + maxVisibleLines) {
			this.scrollOffset = cursorLineIndex - maxVisibleLines + 1;
		}
		const maxScrollOffset = Math.max(0, layoutLines.length - maxVisibleLines);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScrollOffset));
		const visibleLines = layoutLines.slice(this.scrollOffset, this.scrollOffset + maxVisibleLines);
		const result: string[] = [];
		const leftPadding = " ".repeat(paddingX);
		const rightPadding = leftPadding;
		if (this.scrollOffset > 0) {
			const indicator = `─── ↑ ${this.scrollOffset} more `;
			const remaining = width - visibleWidth(indicator);
			result.push(this.borderColor(indicator + "─".repeat(Math.max(0, remaining))));
		} else {
			result.push(horizontal.repeat(width));
		}
		const emitCursorMarker = this.focused && !this.autocompleteState;
		for (const layoutLine of visibleLines) {
			let displayText = layoutLine.text;
			let lineVisibleWidth = visibleWidth(layoutLine.text);
			let cursorInPadding = false;
			if (layoutLine.hasCursor && layoutLine.cursorPos !== undefined) {
				const before = displayText.slice(0, layoutLine.cursorPos);
				const after = displayText.slice(layoutLine.cursorPos);
				const marker = emitCursorMarker ? CURSOR_MARKER : "";
				if (after.length > 0) {
					const afterGraphemes = [...segmenter.segment(after)];
					const firstGrapheme = afterGraphemes[0]?.segment || "";
					const restAfter = after.slice(firstGrapheme.length);
					const cursor = `\x1b[7m${firstGrapheme}\x1b[0m`;
					displayText = before + marker + cursor + restAfter;
				} else {
					const cursor = "\x1b[7m \x1b[0m";
					displayText = before + marker + cursor;
					lineVisibleWidth = lineVisibleWidth + 1;
					if (lineVisibleWidth > contentWidth && paddingX > 0) {
						cursorInPadding = true;
					}
				}
			}
			const padding = " ".repeat(Math.max(0, contentWidth - lineVisibleWidth));
			const lineRightPadding = cursorInPadding ? rightPadding.slice(1) : rightPadding;
			result.push(`${leftPadding}${displayText}${padding}${lineRightPadding}`);
		}
		const linesBelow = layoutLines.length - (this.scrollOffset + visibleLines.length);
		if (linesBelow > 0) {
			const indicator = `─── ↓ ${linesBelow} more `;
			const remaining = width - visibleWidth(indicator);
			result.push(this.borderColor(indicator + "─".repeat(Math.max(0, remaining))));
		} else {
			result.push(horizontal.repeat(width));
		}
		if (this.autocompleteState && this.autocompleteList) {
			const autocompleteResult = this.autocompleteList.render(contentWidth);
			for (const line of autocompleteResult) {
				const lineWidth = visibleWidth(line);
				const linePadding = " ".repeat(Math.max(0, contentWidth - lineWidth));
				result.push(`${leftPadding}${line}${linePadding}${rightPadding}`);
			}
		}
		return result;
	}
	handleInput(data: string): void {
		const kb = getEditorKeybindings();
		if (this.jumpMode !== null) {
			if (kb.matches(data, "jumpForward") || kb.matches(data, "jumpBackward")) {
				this.jumpMode = null;
				return;
			}
			if (data.charCodeAt(0) >= 32) {
				const direction = this.jumpMode;
				this.jumpMode = null;
				this.jumpToChar(data, direction);
				return;
			}
			this.jumpMode = null;
		}
		if (data.includes("\x1b[200~")) {
			this.isInPaste = true;
			this.pasteBuffer = "";
			data = data.replace("\x1b[200~", "");
		}
		if (this.isInPaste) {
			this.pasteBuffer += data;
			const endIndex = this.pasteBuffer.indexOf("\x1b[201~");
			if (endIndex !== -1) {
				const pasteContent = this.pasteBuffer.substring(0, endIndex);
				if (pasteContent.length > 0) {
					this.handlePaste(pasteContent);
				}
				this.isInPaste = false;
				const remaining = this.pasteBuffer.substring(endIndex + 6);
				this.pasteBuffer = "";
				if (remaining.length > 0) {
					this.handleInput(remaining);
				}
				return;
			}
			return;
		}
		if (kb.matches(data, "copy")) {
			return;
		}
		if (kb.matches(data, "undo")) {
			this.undo();
			return;
		}
		if (this.autocompleteState && this.autocompleteList) {
			if (kb.matches(data, "selectCancel")) {
				this.cancelAutocomplete();
				return;
			}
			if (kb.matches(data, "selectUp") || kb.matches(data, "selectDown")) {
				this.autocompleteList.handleInput(data);
				return;
			}
			if (kb.matches(data, "tab")) {
				const selected = this.autocompleteList.getSelectedItem();
				if (selected && this.autocompleteProvider) {
					const shouldChainSlashArgumentAutocomplete = this.shouldChainSlashArgumentAutocompleteOnTabSelection();
					this.pushUndoSnapshot();
					this.lastAction = null;
					const result = this.autocompleteProvider.applyCompletion(
						this.state.lines,
						this.state.cursorLine,
						this.state.cursorCol,
						selected,
						this.autocompletePrefix,
					);
					this.state.lines = result.lines;
					this.state.cursorLine = result.cursorLine;
					this.setCursorCol(result.cursorCol);
					this.cancelAutocomplete();
					if (this.onChange) this.onChange(this.getText());
					if (shouldChainSlashArgumentAutocomplete && this.isBareCompletedSlashCommandAtCursor()) {
						this.tryTriggerAutocomplete();
					}
				}
				return;
			}
			if (kb.matches(data, "selectConfirm")) {
				const selected = this.autocompleteList.getSelectedItem();
				if (selected && this.autocompleteProvider) {
					this.pushUndoSnapshot();
					this.lastAction = null;
					const result = this.autocompleteProvider.applyCompletion(
						this.state.lines,
						this.state.cursorLine,
						this.state.cursorCol,
						selected,
						this.autocompletePrefix,
					);
					this.state.lines = result.lines;
					this.state.cursorLine = result.cursorLine;
					this.setCursorCol(result.cursorCol);
					if (this.autocompletePrefix.startsWith("/")) {
						this.cancelAutocomplete();
					} else {
						this.cancelAutocomplete();
						if (this.onChange) this.onChange(this.getText());
						return;
					}
				}
			}
		}
		if (kb.matches(data, "tab") && !this.autocompleteState) {
			this.handleTabCompletion();
			return;
		}
		if (kb.matches(data, "deleteToLineEnd")) {
			this.deleteToEndOfLine();
			return;
		}
		if (kb.matches(data, "deleteToLineStart")) {
			this.deleteToStartOfLine();
			return;
		}
		if (kb.matches(data, "deleteWordBackward")) {
			this.deleteWordBackwards();
			return;
		}
		if (kb.matches(data, "deleteWordForward")) {
			this.deleteWordForward();
			return;
		}
		if (kb.matches(data, "deleteCharBackward") || matchesKey(data, "shift+backspace")) {
			this.handleBackspace();
			return;
		}
		if (kb.matches(data, "deleteCharForward") || matchesKey(data, "shift+delete")) {
			this.handleForwardDelete();
			return;
		}
		if (kb.matches(data, "yank")) {
			this.yank();
			return;
		}
		if (kb.matches(data, "yankPop")) {
			this.yankPop();
			return;
		}
		if (kb.matches(data, "cursorLineStart")) {
			this.moveToLineStart();
			return;
		}
		if (kb.matches(data, "cursorLineEnd")) {
			this.moveToLineEnd();
			return;
		}
		if (kb.matches(data, "cursorWordLeft")) {
			this.moveWordBackwards();
			return;
		}
		if (kb.matches(data, "cursorWordRight")) {
			this.moveWordForwards();
			return;
		}
		if (
			kb.matches(data, "newLine") ||
			(data.charCodeAt(0) === 10 && data.length > 1) ||
			data === "\x1b\r" ||
			data === "\x1b[13;2~" ||
			(data.length > 1 && data.includes("\x1b") && data.includes("\r")) ||
			(data === "\n" && data.length === 1)
		) {
			if (this.shouldSubmitOnBackslashEnter(data, kb)) {
				this.handleBackspace();
				this.submitValue();
				return;
			}
			this.addNewLine();
			return;
		}
		if (kb.matches(data, "submit")) {
			if (this.disableSubmit) return;
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			if (this.state.cursorCol > 0 && currentLine[this.state.cursorCol - 1] === "\\") {
				this.handleBackspace();
				this.addNewLine();
				return;
			}
			this.submitValue();
			return;
		}
		if (kb.matches(data, "cursorUp")) {
			if (this.isEditorEmpty()) {
				this.navigateHistory(-1);
			} else if (this.historyIndex > -1 && this.isOnFirstVisualLine()) {
				this.navigateHistory(-1);
			} else if (this.isOnFirstVisualLine()) {
				this.moveToLineStart();
			} else {
				this.moveCursor(-1, 0);
			}
			return;
		}
		if (kb.matches(data, "cursorDown")) {
			if (this.historyIndex > -1 && this.isOnLastVisualLine()) {
				this.navigateHistory(1);
			} else if (this.isOnLastVisualLine()) {
				this.moveToLineEnd();
			} else {
				this.moveCursor(1, 0);
			}
			return;
		}
		if (kb.matches(data, "cursorRight")) {
			this.moveCursor(0, 1);
			return;
		}
		if (kb.matches(data, "cursorLeft")) {
			this.moveCursor(0, -1);
			return;
		}
		if (kb.matches(data, "pageUp")) {
			this.pageScroll(-1);
			return;
		}
		if (kb.matches(data, "pageDown")) {
			this.pageScroll(1);
			return;
		}
		if (kb.matches(data, "jumpForward")) {
			this.jumpMode = "forward";
			return;
		}
		if (kb.matches(data, "jumpBackward")) {
			this.jumpMode = "backward";
			return;
		}
		if (matchesKey(data, "shift+space")) {
			this.insertCharacter(" ");
			return;
		}
		const kittyPrintable = decodeKittyPrintable(data);
		if (kittyPrintable !== undefined) {
			this.insertCharacter(kittyPrintable);
			return;
		}
		if (data.charCodeAt(0) >= 32) {
			this.insertCharacter(data);
		}
	}
	private layoutText(contentWidth: number): LayoutLine[] {
		const layoutLines: LayoutLine[] = [];
		if (this.state.lines.length === 0 || (this.state.lines.length === 1 && this.state.lines[0] === "")) {
			layoutLines.push({
				text: "",
				hasCursor: true,
				cursorPos: 0,
			});
			return layoutLines;
		}
		for (let i = 0; i < this.state.lines.length; i++) {
			const line = this.state.lines[i] || "";
			const isCurrentLine = i === this.state.cursorLine;
			const lineVisibleWidth = visibleWidth(line);
			if (lineVisibleWidth <= contentWidth) {
				if (isCurrentLine) {
					layoutLines.push({
						text: line,
						hasCursor: true,
						cursorPos: this.state.cursorCol,
					});
				} else {
					layoutLines.push({
						text: line,
						hasCursor: false,
					});
				}
			} else {
				const chunks = wordWrapLine(line, contentWidth);
				for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
					const chunk = chunks[chunkIndex];
					if (!chunk) continue;
					const cursorPos = this.state.cursorCol;
					const isLastChunk = chunkIndex === chunks.length - 1;
					let hasCursorInChunk = false;
					let adjustedCursorPos = 0;
					if (isCurrentLine) {
						if (isLastChunk) {
							hasCursorInChunk = cursorPos >= chunk.startIndex;
							adjustedCursorPos = cursorPos - chunk.startIndex;
						} else {
							hasCursorInChunk = cursorPos >= chunk.startIndex && cursorPos < chunk.endIndex;
							if (hasCursorInChunk) {
								adjustedCursorPos = cursorPos - chunk.startIndex;
								if (adjustedCursorPos > chunk.text.length) {
									adjustedCursorPos = chunk.text.length;
								}
							}
						}
					}
					if (hasCursorInChunk) {
						layoutLines.push({
							text: chunk.text,
							hasCursor: true,
							cursorPos: adjustedCursorPos,
						});
					} else {
						layoutLines.push({
							text: chunk.text,
							hasCursor: false,
						});
					}
				}
			}
		}
		return layoutLines;
	}
	getText(): string {
		return this.state.lines.join("\n");
	}
	getExpandedText(): string {
		let result = this.state.lines.join("\n");
		for (const [pasteId, pasteContent] of this.pastes) {
			const markerRegex = new RegExp(`\\[paste #${pasteId}( (\\+\\d+ lines|\\d+ chars))?\\]`, "g");
			result = result.replace(markerRegex, pasteContent);
		}
		return result;
	}
	getLines(): string[] {
		return [...this.state.lines];
	}
	getCursor(): { line: number; col: number } {
		return { line: this.state.cursorLine, col: this.state.cursorCol };
	}
	setText(text: string): void {
		this.lastAction = null;
		this.historyIndex = -1;
		if (this.getText() !== text) {
			this.pushUndoSnapshot();
		}
		this.setTextInternal(text);
	}
	insertTextAtCursor(text: string): void {
		if (!text) return;
		this.pushUndoSnapshot();
		this.lastAction = null;
		this.historyIndex = -1;
		this.insertTextAtCursorInternal(text);
	}
	private insertTextAtCursorInternal(text: string): void {
		if (!text) return;
		const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		const insertedLines = normalized.split("\n");
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const beforeCursor = currentLine.slice(0, this.state.cursorCol);
		const afterCursor = currentLine.slice(this.state.cursorCol);
		if (insertedLines.length === 1) {
			this.state.lines[this.state.cursorLine] = beforeCursor + normalized + afterCursor;
			this.setCursorCol(this.state.cursorCol + normalized.length);
		} else {
			this.state.lines = [
				...this.state.lines.slice(0, this.state.cursorLine),
				beforeCursor + insertedLines[0],
				...insertedLines.slice(1, -1),
				insertedLines[insertedLines.length - 1] + afterCursor,
				...this.state.lines.slice(this.state.cursorLine + 1),
			];
			this.state.cursorLine += insertedLines.length - 1;
			this.setCursorCol((insertedLines[insertedLines.length - 1] || "").length);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private insertCharacter(char: string, skipUndoCoalescing?: boolean): void {
		this.historyIndex = -1;
		if (!skipUndoCoalescing) {
			if (isWhitespaceChar(char) || this.lastAction !== "type-word") {
				this.pushUndoSnapshot();
			}
			this.lastAction = "type-word";
		}
		const line = this.state.lines[this.state.cursorLine] || "";
		const before = line.slice(0, this.state.cursorCol);
		const after = line.slice(this.state.cursorCol);
		this.state.lines[this.state.cursorLine] = before + char + after;
		this.setCursorCol(this.state.cursorCol + char.length);
		if (this.onChange) {
			this.onChange(this.getText());
		}
		if (!this.autocompleteState) {
			if (char === "/" && this.isAtStartOfMessage()) {
				this.tryTriggerAutocomplete();
			} else if (char === "@") {
				const currentLine = this.state.lines[this.state.cursorLine] || "";
				const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
				const charBeforeAt = textBeforeCursor[textBeforeCursor.length - 2];
				if (textBeforeCursor.length === 1 || charBeforeAt === " " || charBeforeAt === "\t") {
					this.tryTriggerAutocomplete();
				}
			} else if (/[a-zA-Z0-9.\-_]/.test(char)) {
				const currentLine = this.state.lines[this.state.cursorLine] || "";
				const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
				if (this.isInSlashCommandContext(textBeforeCursor)) {
					this.tryTriggerAutocomplete();
				} else if (textBeforeCursor.match(/(?:^|[\s])@[^\s]*$/)) {
					this.tryTriggerAutocomplete();
				}
			}
		} else {
			this.updateAutocomplete();
		}
	}
	private handlePaste(pastedText: string): void {
		this.historyIndex = -1;
		this.lastAction = null;
		this.pushUndoSnapshot();
		const cleanText = pastedText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		const tabExpandedText = cleanText.replace(/\t/g, "    ");
		let filteredText = tabExpandedText
			.split("")
			.filter((char) => char === "\n" || char.charCodeAt(0) >= 32)
			.join("");
		if (/^[/~.]/.test(filteredText)) {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const charBeforeCursor = this.state.cursorCol > 0 ? currentLine[this.state.cursorCol - 1] : "";
			if (charBeforeCursor && /\w/.test(charBeforeCursor)) {
				filteredText = ` ${filteredText}`;
			}
		}
		const pastedLines = filteredText.split("\n");
		const totalChars = filteredText.length;
		if (pastedLines.length > 10 || totalChars > 1000) {
			this.pasteCounter++;
			const pasteId = this.pasteCounter;
			this.pastes.set(pasteId, filteredText);
			const marker =
				pastedLines.length > 10
					? `[paste #${pasteId} +${pastedLines.length} lines]`
					: `[paste #${pasteId} ${totalChars} chars]`;
			this.insertTextAtCursorInternal(marker);
			return;
		}
		if (pastedLines.length === 1) {
			this.insertTextAtCursorInternal(filteredText);
			return;
		}
		this.insertTextAtCursorInternal(filteredText);
	}
	private addNewLine(): void {
		this.historyIndex = -1;
		this.lastAction = null;
		this.pushUndoSnapshot();
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const before = currentLine.slice(0, this.state.cursorCol);
		const after = currentLine.slice(this.state.cursorCol);
		this.state.lines[this.state.cursorLine] = before;
		this.state.lines.splice(this.state.cursorLine + 1, 0, after);
		this.state.cursorLine++;
		this.setCursorCol(0);
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private shouldSubmitOnBackslashEnter(data: string, kb: ReturnType<typeof getEditorKeybindings>): boolean {
		if (this.disableSubmit) return false;
		if (!matchesKey(data, "enter")) return false;
		const submitKeys = kb.getKeys("submit");
		const hasShiftEnter = submitKeys.includes("shift+enter") || submitKeys.includes("shift+return");
		if (!hasShiftEnter) return false;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		return this.state.cursorCol > 0 && currentLine[this.state.cursorCol - 1] === "\\";
	}
	private submitValue(): void {
		let result = this.state.lines.join("\n").trim();
		for (const [pasteId, pasteContent] of this.pastes) {
			const markerRegex = new RegExp(`\\[paste #${pasteId}( (\\+\\d+ lines|\\d+ chars))?\\]`, "g");
			result = result.replace(markerRegex, pasteContent);
		}
		this.state = { lines: [""], cursorLine: 0, cursorCol: 0 };
		this.pastes.clear();
		this.pasteCounter = 0;
		this.historyIndex = -1;
		this.scrollOffset = 0;
		this.undoStack.clear();
		this.lastAction = null;
		if (this.onChange) this.onChange("");
		if (this.onSubmit) this.onSubmit(result);
	}
	private handleBackspace(): void {
		this.historyIndex = -1;
		this.lastAction = null;
		if (this.state.cursorCol > 0) {
			this.pushUndoSnapshot();
			const line = this.state.lines[this.state.cursorLine] || "";
			const beforeCursor = line.slice(0, this.state.cursorCol);
			const graphemes = [...segmenter.segment(beforeCursor)];
			const lastGrapheme = graphemes[graphemes.length - 1];
			const graphemeLength = lastGrapheme ? lastGrapheme.segment.length : 1;
			const before = line.slice(0, this.state.cursorCol - graphemeLength);
			const after = line.slice(this.state.cursorCol);
			this.state.lines[this.state.cursorLine] = before + after;
			this.setCursorCol(this.state.cursorCol - graphemeLength);
		} else if (this.state.cursorLine > 0) {
			this.pushUndoSnapshot();
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const previousLine = this.state.lines[this.state.cursorLine - 1] || "";
			this.state.lines[this.state.cursorLine - 1] = previousLine + currentLine;
			this.state.lines.splice(this.state.cursorLine, 1);
			this.state.cursorLine--;
			this.setCursorCol(previousLine.length);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
		if (this.autocompleteState) {
			this.updateAutocomplete();
		} else {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
			if (this.isInSlashCommandContext(textBeforeCursor)) {
				this.tryTriggerAutocomplete();
			} else if (textBeforeCursor.match(/(?:^|[\s])@[^\s]*$/)) {
				this.tryTriggerAutocomplete();
			}
		}
	}
	private setCursorCol(col: number): void {
		this.state.cursorCol = col;
		this.preferredVisualCol = null;
	}
	private moveToVisualLine(
		visualLines: Array<{ logicalLine: number; startCol: number; length: number }>,
		currentVisualLine: number,
		targetVisualLine: number,
	): void {
		const currentVL = visualLines[currentVisualLine];
		const targetVL = visualLines[targetVisualLine];
		if (currentVL && targetVL) {
			const currentVisualCol = this.state.cursorCol - currentVL.startCol;
			const isLastSourceSegment =
				currentVisualLine === visualLines.length - 1 ||
				visualLines[currentVisualLine + 1]?.logicalLine !== currentVL.logicalLine;
			const sourceMaxVisualCol = isLastSourceSegment ? currentVL.length : Math.max(0, currentVL.length - 1);
			const isLastTargetSegment =
				targetVisualLine === visualLines.length - 1 ||
				visualLines[targetVisualLine + 1]?.logicalLine !== targetVL.logicalLine;
			const targetMaxVisualCol = isLastTargetSegment ? targetVL.length : Math.max(0, targetVL.length - 1);
			const moveToVisualCol = this.computeVerticalMoveColumn(
				currentVisualCol,
				sourceMaxVisualCol,
				targetMaxVisualCol,
			);
			this.state.cursorLine = targetVL.logicalLine;
			const targetCol = targetVL.startCol + moveToVisualCol;
			const logicalLine = this.state.lines[targetVL.logicalLine] || "";
			this.state.cursorCol = Math.min(targetCol, logicalLine.length);
		}
	}
	private computeVerticalMoveColumn(
		currentVisualCol: number,
		sourceMaxVisualCol: number,
		targetMaxVisualCol: number,
	): number {
		const hasPreferred = this.preferredVisualCol !== null;
		const cursorInMiddle = currentVisualCol < sourceMaxVisualCol;
		const targetTooShort = targetMaxVisualCol < currentVisualCol;
		if (!hasPreferred || cursorInMiddle) {
			if (targetTooShort) {
				this.preferredVisualCol = currentVisualCol;
				return targetMaxVisualCol;
			}
			this.preferredVisualCol = null;
			return currentVisualCol;
		}
		const targetCantFitPreferred = targetMaxVisualCol < this.preferredVisualCol!;
		if (targetTooShort || targetCantFitPreferred) {
			return targetMaxVisualCol;
		}
		const result = this.preferredVisualCol!;
		this.preferredVisualCol = null;
		return result;
	}
	private moveToLineStart(): void {
		this.lastAction = null;
		this.setCursorCol(0);
	}
	private moveToLineEnd(): void {
		this.lastAction = null;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		this.setCursorCol(currentLine.length);
	}
	private deleteToStartOfLine(): void {
		this.historyIndex = -1;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		if (this.state.cursorCol > 0) {
			this.pushUndoSnapshot();
			const deletedText = currentLine.slice(0, this.state.cursorCol);
			this.killRing.push(deletedText, { prepend: true, accumulate: this.lastAction === "kill" });
			this.lastAction = "kill";
			this.state.lines[this.state.cursorLine] = currentLine.slice(this.state.cursorCol);
			this.setCursorCol(0);
		} else if (this.state.cursorLine > 0) {
			this.pushUndoSnapshot();
			this.killRing.push("\n", { prepend: true, accumulate: this.lastAction === "kill" });
			this.lastAction = "kill";
			const previousLine = this.state.lines[this.state.cursorLine - 1] || "";
			this.state.lines[this.state.cursorLine - 1] = previousLine + currentLine;
			this.state.lines.splice(this.state.cursorLine, 1);
			this.state.cursorLine--;
			this.setCursorCol(previousLine.length);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private deleteToEndOfLine(): void {
		this.historyIndex = -1;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		if (this.state.cursorCol < currentLine.length) {
			this.pushUndoSnapshot();
			const deletedText = currentLine.slice(this.state.cursorCol);
			this.killRing.push(deletedText, { prepend: false, accumulate: this.lastAction === "kill" });
			this.lastAction = "kill";
			this.state.lines[this.state.cursorLine] = currentLine.slice(0, this.state.cursorCol);
		} else if (this.state.cursorLine < this.state.lines.length - 1) {
			this.pushUndoSnapshot();
			this.killRing.push("\n", { prepend: false, accumulate: this.lastAction === "kill" });
			this.lastAction = "kill";
			const nextLine = this.state.lines[this.state.cursorLine + 1] || "";
			this.state.lines[this.state.cursorLine] = currentLine + nextLine;
			this.state.lines.splice(this.state.cursorLine + 1, 1);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private deleteWordBackwards(): void {
		this.historyIndex = -1;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		if (this.state.cursorCol === 0) {
			if (this.state.cursorLine > 0) {
				this.pushUndoSnapshot();
				this.killRing.push("\n", { prepend: true, accumulate: this.lastAction === "kill" });
				this.lastAction = "kill";
				const previousLine = this.state.lines[this.state.cursorLine - 1] || "";
				this.state.lines[this.state.cursorLine - 1] = previousLine + currentLine;
				this.state.lines.splice(this.state.cursorLine, 1);
				this.state.cursorLine--;
				this.setCursorCol(previousLine.length);
			}
		} else {
			this.pushUndoSnapshot();
			const wasKill = this.lastAction === "kill";
			const oldCursorCol = this.state.cursorCol;
			this.moveWordBackwards();
			const deleteFrom = this.state.cursorCol;
			this.setCursorCol(oldCursorCol);
			const deletedText = currentLine.slice(deleteFrom, this.state.cursorCol);
			this.killRing.push(deletedText, { prepend: true, accumulate: wasKill });
			this.lastAction = "kill";
			this.state.lines[this.state.cursorLine] =
				currentLine.slice(0, deleteFrom) + currentLine.slice(this.state.cursorCol);
			this.setCursorCol(deleteFrom);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private deleteWordForward(): void {
		this.historyIndex = -1;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		if (this.state.cursorCol >= currentLine.length) {
			if (this.state.cursorLine < this.state.lines.length - 1) {
				this.pushUndoSnapshot();
				this.killRing.push("\n", { prepend: false, accumulate: this.lastAction === "kill" });
				this.lastAction = "kill";
				const nextLine = this.state.lines[this.state.cursorLine + 1] || "";
				this.state.lines[this.state.cursorLine] = currentLine + nextLine;
				this.state.lines.splice(this.state.cursorLine + 1, 1);
			}
		} else {
			this.pushUndoSnapshot();
			const wasKill = this.lastAction === "kill";
			const oldCursorCol = this.state.cursorCol;
			this.moveWordForwards();
			const deleteTo = this.state.cursorCol;
			this.setCursorCol(oldCursorCol);
			const deletedText = currentLine.slice(this.state.cursorCol, deleteTo);
			this.killRing.push(deletedText, { prepend: false, accumulate: wasKill });
			this.lastAction = "kill";
			this.state.lines[this.state.cursorLine] =
				currentLine.slice(0, this.state.cursorCol) + currentLine.slice(deleteTo);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private handleForwardDelete(): void {
		this.historyIndex = -1;
		this.lastAction = null;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		if (this.state.cursorCol < currentLine.length) {
			this.pushUndoSnapshot();
			const afterCursor = currentLine.slice(this.state.cursorCol);
			const graphemes = [...segmenter.segment(afterCursor)];
			const firstGrapheme = graphemes[0];
			const graphemeLength = firstGrapheme ? firstGrapheme.segment.length : 1;
			const before = currentLine.slice(0, this.state.cursorCol);
			const after = currentLine.slice(this.state.cursorCol + graphemeLength);
			this.state.lines[this.state.cursorLine] = before + after;
		} else if (this.state.cursorLine < this.state.lines.length - 1) {
			this.pushUndoSnapshot();
			const nextLine = this.state.lines[this.state.cursorLine + 1] || "";
			this.state.lines[this.state.cursorLine] = currentLine + nextLine;
			this.state.lines.splice(this.state.cursorLine + 1, 1);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
		if (this.autocompleteState) {
			this.updateAutocomplete();
		} else {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
			if (this.isInSlashCommandContext(textBeforeCursor)) {
				this.tryTriggerAutocomplete();
			} else if (textBeforeCursor.match(/(?:^|[\s])@[^\s]*$/)) {
				this.tryTriggerAutocomplete();
			}
		}
	}
	private buildVisualLineMap(width: number): Array<{ logicalLine: number; startCol: number; length: number }> {
		const visualLines: Array<{ logicalLine: number; startCol: number; length: number }> = [];
		for (let i = 0; i < this.state.lines.length; i++) {
			const line = this.state.lines[i] || "";
			const lineVisWidth = visibleWidth(line);
			if (line.length === 0) {
				visualLines.push({ logicalLine: i, startCol: 0, length: 0 });
			} else if (lineVisWidth <= width) {
				visualLines.push({ logicalLine: i, startCol: 0, length: line.length });
			} else {
				const chunks = wordWrapLine(line, width);
				for (const chunk of chunks) {
					visualLines.push({
						logicalLine: i,
						startCol: chunk.startIndex,
						length: chunk.endIndex - chunk.startIndex,
					});
				}
			}
		}
		return visualLines;
	}
	private findCurrentVisualLine(
		visualLines: Array<{ logicalLine: number; startCol: number; length: number }>,
	): number {
		for (let i = 0; i < visualLines.length; i++) {
			const vl = visualLines[i];
			if (!vl) continue;
			if (vl.logicalLine === this.state.cursorLine) {
				const colInSegment = this.state.cursorCol - vl.startCol;
				const isLastSegmentOfLine =
					i === visualLines.length - 1 || visualLines[i + 1]?.logicalLine !== vl.logicalLine;
				if (colInSegment >= 0 && (colInSegment < vl.length || (isLastSegmentOfLine && colInSegment <= vl.length))) {
					return i;
				}
			}
		}
		return visualLines.length - 1;
	}
	private moveCursor(deltaLine: number, deltaCol: number): void {
		this.lastAction = null;
		const visualLines = this.buildVisualLineMap(this.lastWidth);
		const currentVisualLine = this.findCurrentVisualLine(visualLines);
		if (deltaLine !== 0) {
			const targetVisualLine = currentVisualLine + deltaLine;
			if (targetVisualLine >= 0 && targetVisualLine < visualLines.length) {
				this.moveToVisualLine(visualLines, currentVisualLine, targetVisualLine);
			}
		}
		if (deltaCol !== 0) {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			if (deltaCol > 0) {
				if (this.state.cursorCol < currentLine.length) {
					const afterCursor = currentLine.slice(this.state.cursorCol);
					const graphemes = [...segmenter.segment(afterCursor)];
					const firstGrapheme = graphemes[0];
					this.setCursorCol(this.state.cursorCol + (firstGrapheme ? firstGrapheme.segment.length : 1));
				} else if (this.state.cursorLine < this.state.lines.length - 1) {
					this.state.cursorLine++;
					this.setCursorCol(0);
				} else {
					const currentVL = visualLines[currentVisualLine];
					if (currentVL) {
						this.preferredVisualCol = this.state.cursorCol - currentVL.startCol;
					}
				}
			} else {
				if (this.state.cursorCol > 0) {
					const beforeCursor = currentLine.slice(0, this.state.cursorCol);
					const graphemes = [...segmenter.segment(beforeCursor)];
					const lastGrapheme = graphemes[graphemes.length - 1];
					this.setCursorCol(this.state.cursorCol - (lastGrapheme ? lastGrapheme.segment.length : 1));
				} else if (this.state.cursorLine > 0) {
					this.state.cursorLine--;
					const prevLine = this.state.lines[this.state.cursorLine] || "";
					this.setCursorCol(prevLine.length);
				}
			}
		}
	}
	private pageScroll(direction: -1 | 1): void {
		this.lastAction = null;
		const terminalRows = this.tui.terminal.rows;
		const pageSize = Math.max(5, Math.floor(terminalRows * 0.3));
		const visualLines = this.buildVisualLineMap(this.lastWidth);
		const currentVisualLine = this.findCurrentVisualLine(visualLines);
		const targetVisualLine = Math.max(0, Math.min(visualLines.length - 1, currentVisualLine + direction * pageSize));
		this.moveToVisualLine(visualLines, currentVisualLine, targetVisualLine);
	}
	private moveWordBackwards(): void {
		this.lastAction = null;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		if (this.state.cursorCol === 0) {
			if (this.state.cursorLine > 0) {
				this.state.cursorLine--;
				const prevLine = this.state.lines[this.state.cursorLine] || "";
				this.setCursorCol(prevLine.length);
			}
			return;
		}
		const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
		const graphemes = [...segmenter.segment(textBeforeCursor)];
		let newCol = this.state.cursorCol;
		while (graphemes.length > 0 && isWhitespaceChar(graphemes[graphemes.length - 1]?.segment || "")) {
			newCol -= graphemes.pop()?.segment.length || 0;
		}
		if (graphemes.length > 0) {
			const lastGrapheme = graphemes[graphemes.length - 1]?.segment || "";
			if (isPunctuationChar(lastGrapheme)) {
				while (graphemes.length > 0 && isPunctuationChar(graphemes[graphemes.length - 1]?.segment || "")) {
					newCol -= graphemes.pop()?.segment.length || 0;
				}
			} else {
				while (
					graphemes.length > 0 &&
					!isWhitespaceChar(graphemes[graphemes.length - 1]?.segment || "") &&
					!isPunctuationChar(graphemes[graphemes.length - 1]?.segment || "")
				) {
					newCol -= graphemes.pop()?.segment.length || 0;
				}
			}
		}
		this.setCursorCol(newCol);
	}
	private yank(): void {
		if (this.killRing.length === 0) return;
		this.pushUndoSnapshot();
		const text = this.killRing.peek()!;
		this.insertYankedText(text);
		this.lastAction = "yank";
	}
	private yankPop(): void {
		if (this.lastAction !== "yank" || this.killRing.length <= 1) return;
		this.pushUndoSnapshot();
		this.deleteYankedText();
		this.killRing.rotate();
		const text = this.killRing.peek()!;
		this.insertYankedText(text);
		this.lastAction = "yank";
	}
	private insertYankedText(text: string): void {
		this.historyIndex = -1;
		const lines = text.split("\n");
		if (lines.length === 1) {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const before = currentLine.slice(0, this.state.cursorCol);
			const after = currentLine.slice(this.state.cursorCol);
			this.state.lines[this.state.cursorLine] = before + text + after;
			this.setCursorCol(this.state.cursorCol + text.length);
		} else {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const before = currentLine.slice(0, this.state.cursorCol);
			const after = currentLine.slice(this.state.cursorCol);
			this.state.lines[this.state.cursorLine] = before + (lines[0] || "");
			for (let i = 1; i < lines.length - 1; i++) {
				this.state.lines.splice(this.state.cursorLine + i, 0, lines[i] || "");
			}
			const lastLineIndex = this.state.cursorLine + lines.length - 1;
			this.state.lines.splice(lastLineIndex, 0, (lines[lines.length - 1] || "") + after);
			this.state.cursorLine = lastLineIndex;
			this.setCursorCol((lines[lines.length - 1] || "").length);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private deleteYankedText(): void {
		const yankedText = this.killRing.peek();
		if (!yankedText) return;
		const yankLines = yankedText.split("\n");
		if (yankLines.length === 1) {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const deleteLen = yankedText.length;
			const before = currentLine.slice(0, this.state.cursorCol - deleteLen);
			const after = currentLine.slice(this.state.cursorCol);
			this.state.lines[this.state.cursorLine] = before + after;
			this.setCursorCol(this.state.cursorCol - deleteLen);
		} else {
			const startLine = this.state.cursorLine - (yankLines.length - 1);
			const startCol = (this.state.lines[startLine] || "").length - (yankLines[0] || "").length;
			const afterCursor = (this.state.lines[this.state.cursorLine] || "").slice(this.state.cursorCol);
			const beforeYank = (this.state.lines[startLine] || "").slice(0, startCol);
			this.state.lines.splice(startLine, yankLines.length, beforeYank + afterCursor);
			this.state.cursorLine = startLine;
			this.setCursorCol(startCol);
		}
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private pushUndoSnapshot(): void {
		this.undoStack.push(this.state);
	}
	private undo(): void {
		this.historyIndex = -1;
		const snapshot = this.undoStack.pop();
		if (!snapshot) return;
		Object.assign(this.state, snapshot);
		this.lastAction = null;
		this.preferredVisualCol = null;
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}
	private jumpToChar(char: string, direction: "forward" | "backward"): void {
		this.lastAction = null;
		const isForward = direction === "forward";
		const lines = this.state.lines;
		const end = isForward ? lines.length : -1;
		const step = isForward ? 1 : -1;
		for (let lineIdx = this.state.cursorLine; lineIdx !== end; lineIdx += step) {
			const line = lines[lineIdx] || "";
			const isCurrentLine = lineIdx === this.state.cursorLine;
			const searchFrom = isCurrentLine
				? isForward
					? this.state.cursorCol + 1
					: this.state.cursorCol - 1
				: undefined;
			const idx = isForward ? line.indexOf(char, searchFrom) : line.lastIndexOf(char, searchFrom);
			if (idx !== -1) {
				this.state.cursorLine = lineIdx;
				this.setCursorCol(idx);
				return;
			}
		}
	}
	private moveWordForwards(): void {
		this.lastAction = null;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		if (this.state.cursorCol >= currentLine.length) {
			if (this.state.cursorLine < this.state.lines.length - 1) {
				this.state.cursorLine++;
				this.setCursorCol(0);
			}
			return;
		}
		const textAfterCursor = currentLine.slice(this.state.cursorCol);
		const segments = segmenter.segment(textAfterCursor);
		const iterator = segments[Symbol.iterator]();
		let next = iterator.next();
		let newCol = this.state.cursorCol;
		while (!next.done && isWhitespaceChar(next.value.segment)) {
			newCol += next.value.segment.length;
			next = iterator.next();
		}
		if (!next.done) {
			const firstGrapheme = next.value.segment;
			if (isPunctuationChar(firstGrapheme)) {
				while (!next.done && isPunctuationChar(next.value.segment)) {
					newCol += next.value.segment.length;
					next = iterator.next();
				}
			} else {
				while (!next.done && !isWhitespaceChar(next.value.segment) && !isPunctuationChar(next.value.segment)) {
					newCol += next.value.segment.length;
					next = iterator.next();
				}
			}
		}
		this.setCursorCol(newCol);
	}
	private isSlashMenuAllowed(): boolean {
		return this.state.cursorLine === 0;
	}
	private isAtStartOfMessage(): boolean {
		if (!this.isSlashMenuAllowed()) return false;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const beforeCursor = currentLine.slice(0, this.state.cursorCol);
		return beforeCursor.trim() === "" || beforeCursor.trim() === "/";
	}
	private isInSlashCommandContext(textBeforeCursor: string): boolean {
		return this.isSlashMenuAllowed() && textBeforeCursor.trimStart().startsWith("/");
	}
	private shouldChainSlashArgumentAutocompleteOnTabSelection(): boolean {
		if (this.autocompleteState !== "regular") {
			return false;
		}
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
		return this.isInSlashCommandContext(textBeforeCursor) && !textBeforeCursor.trimStart().includes(" ");
	}
	private isBareCompletedSlashCommandAtCursor(): boolean {
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		if (this.state.cursorCol !== currentLine.length) {
			return false;
		}
		const textBeforeCursor = currentLine.slice(0, this.state.cursorCol).trimStart();
		return /^\/\S+ $/.test(textBeforeCursor);
	}
	private getBestAutocompleteMatchIndex(items: Array<{ value: string; label: string }>, prefix: string): number {
		if (!prefix) return -1;
		let firstPrefixIndex = -1;
		for (let i = 0; i < items.length; i++) {
			const value = items[i]!.value;
			if (value === prefix) {
				return i;
			}
			if (firstPrefixIndex === -1 && value.startsWith(prefix)) {
				firstPrefixIndex = i;
			}
		}
		return firstPrefixIndex;
	}
	private tryTriggerAutocomplete(explicitTab: boolean = false): void {
		if (!this.autocompleteProvider) return;
		if (explicitTab) {
			const provider = this.autocompleteProvider as CombinedAutocompleteProvider;
			const shouldTrigger =
				!provider.shouldTriggerFileCompletion ||
				provider.shouldTriggerFileCompletion(this.state.lines, this.state.cursorLine, this.state.cursorCol);
			if (!shouldTrigger) {
				return;
			}
		}
		const suggestions = this.autocompleteProvider.getSuggestions(
			this.state.lines,
			this.state.cursorLine,
			this.state.cursorCol,
		);
		if (suggestions && suggestions.items.length > 0) {
			this.autocompletePrefix = suggestions.prefix;
			this.autocompleteList = new SelectList(suggestions.items, this.autocompleteMaxVisible, this.theme.selectList);
			const bestMatchIndex = this.getBestAutocompleteMatchIndex(suggestions.items, suggestions.prefix);
			if (bestMatchIndex >= 0) {
				this.autocompleteList.setSelectedIndex(bestMatchIndex);
			}
			this.autocompleteState = "regular";
		} else {
			this.cancelAutocomplete();
		}
	}
	private handleTabCompletion(): void {
		if (!this.autocompleteProvider) return;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const beforeCursor = currentLine.slice(0, this.state.cursorCol);
		if (this.isInSlashCommandContext(beforeCursor) && !beforeCursor.trimStart().includes(" ")) {
			this.handleSlashCommandCompletion();
		} else {
			this.forceFileAutocomplete(true);
		}
	}
	private handleSlashCommandCompletion(): void {
		this.tryTriggerAutocomplete(true);
	}
	private forceFileAutocomplete(explicitTab: boolean = false): void {
		if (!this.autocompleteProvider) return;
		const provider = this.autocompleteProvider as {
			getForceFileSuggestions?: CombinedAutocompleteProvider["getForceFileSuggestions"];
		};
		if (typeof provider.getForceFileSuggestions !== "function") {
			this.tryTriggerAutocomplete(true);
			return;
		}
		const suggestions = provider.getForceFileSuggestions(
			this.state.lines,
			this.state.cursorLine,
			this.state.cursorCol,
		);
		if (suggestions && suggestions.items.length > 0) {
			if (explicitTab && suggestions.items.length === 1) {
				const item = suggestions.items[0]!;
				this.pushUndoSnapshot();
				this.lastAction = null;
				const result = this.autocompleteProvider.applyCompletion(
					this.state.lines,
					this.state.cursorLine,
					this.state.cursorCol,
					item,
					suggestions.prefix,
				);
				this.state.lines = result.lines;
				this.state.cursorLine = result.cursorLine;
				this.setCursorCol(result.cursorCol);
				if (this.onChange) this.onChange(this.getText());
				return;
			}
			this.autocompletePrefix = suggestions.prefix;
			this.autocompleteList = new SelectList(suggestions.items, this.autocompleteMaxVisible, this.theme.selectList);
			const bestMatchIndex = this.getBestAutocompleteMatchIndex(suggestions.items, suggestions.prefix);
			if (bestMatchIndex >= 0) {
				this.autocompleteList.setSelectedIndex(bestMatchIndex);
			}
			this.autocompleteState = "force";
		} else {
			this.cancelAutocomplete();
		}
	}
	private cancelAutocomplete(): void {
		this.autocompleteState = null;
		this.autocompleteList = undefined;
		this.autocompletePrefix = "";
	}
	public isShowingAutocomplete(): boolean {
		return this.autocompleteState !== null;
	}
	private updateAutocomplete(): void {
		if (!this.autocompleteState || !this.autocompleteProvider) return;
		if (this.autocompleteState === "force") {
			this.forceFileAutocomplete();
			return;
		}
		const suggestions = this.autocompleteProvider.getSuggestions(
			this.state.lines,
			this.state.cursorLine,
			this.state.cursorCol,
		);
		if (suggestions && suggestions.items.length > 0) {
			this.autocompletePrefix = suggestions.prefix;
			this.autocompleteList = new SelectList(suggestions.items, this.autocompleteMaxVisible, this.theme.selectList);
			const bestMatchIndex = this.getBestAutocompleteMatchIndex(suggestions.items, suggestions.prefix);
			if (bestMatchIndex >= 0) {
				this.autocompleteList.setSelectedIndex(bestMatchIndex);
			}
		} else {
			this.cancelAutocomplete();
		}
	}
}
