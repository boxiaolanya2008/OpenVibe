import { type EditorAction, getEditorKeybindings, type KeyId } from "@boxiaolanya2008/pi-tui";
import type { AppAction, KeybindingsManager } from "../../../core/keybindings.js";
import { theme } from "../theme/theme.js";

function formatKeys(keys: KeyId[]): string {
	if (keys.length === 0) return "";
	if (keys.length === 1) return keys[0]!;
	return keys.join("/");
}
export function editorKey(action: EditorAction): string {
	return formatKeys(getEditorKeybindings().getKeys(action));
}
export function appKey(keybindings: KeybindingsManager, action: AppAction): string {
	return formatKeys(keybindings.getKeys(action));
}
export function keyHint(action: EditorAction, description: string): string {
	return theme.fg("dim", editorKey(action)) + theme.fg("muted", ` ${description}`);
}
export function appKeyHint(keybindings: KeybindingsManager, action: AppAction, description: string): string {
	return theme.fg("dim", appKey(keybindings, action)) + theme.fg("muted", ` ${description}`);
}
export function rawKeyHint(key: string, description: string): string {
	return theme.fg("dim", key) + theme.fg("muted", ` ${description}`);
}
