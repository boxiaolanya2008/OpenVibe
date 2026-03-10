import { execSync, spawn } from "child_process";
import { platform } from "os";
import { isWaylandSession } from "./clipboard-image.js";
export function copyToClipboard(text: string): void {
	const encoded = Buffer.from(text).toString("base64");
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);
	const p = platform();
	const options = { input: text, timeout: 5000 };
	try {
		if (p === "darwin") {
			execSync("pbcopy", options);
		} else if (p === "win32") {
			execSync("clip", options);
		} else {
			if (process.env.TERMUX_VERSION) {
				try {
					execSync("termux-clipboard-set", options);
					return;
				} catch {}
			}
			const isWayland = isWaylandSession();
			if (isWayland) {
				try {
					execSync("which wl-copy", { stdio: "ignore" });
					const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
					proc.stdin.on("error", () => {});
					proc.stdin.write(text);
					proc.stdin.end();
					proc.unref();
				} catch {
					try {
						execSync("xclip -selection clipboard", options);
					} catch {
						execSync("xsel --clipboard --input", options);
					}
				}
			} else {
				try {
					execSync("xclip -selection clipboard", options);
				} catch {
					execSync("xsel --clipboard --input", options);
				}
			}
		}
	} catch {}
}
