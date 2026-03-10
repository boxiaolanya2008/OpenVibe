import { getEditorKeybindings } from "../keybindings.js";
import { Loader } from "./loader.js";
export class CancellableLoader extends Loader {
	private abortController = new AbortController();
	onAbort?: () => void;
	get signal(): AbortSignal {
		return this.abortController.signal;
	}
	get aborted(): boolean {
		return this.abortController.signal.aborted;
	}
	handleInput(data: string): void {
		const kb = getEditorKeybindings();
		if (kb.matches(data, "selectCancel")) {
			this.abortController.abort();
			this.onAbort?.();
		}
	}
	dispose(): void {
		this.stop();
	}
}
