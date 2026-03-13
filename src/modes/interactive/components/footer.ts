import { type Component, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { AgentSession } from "../../../core/agent-session.js";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.js";
import { theme } from "../theme/theme.js";

function sanitizeStatusText(text: string): string {
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}
export class FooterComponent implements Component {
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: used by interactive-mode.ts for future auto-compact indicator
	private autoCompactEnabled: boolean = false;
	constructor(
		private session: AgentSession,
		private footerData: ReadonlyFooterDataProvider,
	) {}
	setAutoCompactEnabled(enabled: boolean): void {
		this.autoCompactEnabled = enabled;
	}
	invalidate(): void {}
	dispose(): void {}
	render(width: number): string[] {
		const state = this.session.state;
		let pwd = process.cwd();
		const home = process.env.HOME || process.env.USERPROFILE;
		if (home && pwd.startsWith(home)) {
			pwd = `~${pwd.slice(home.length)}`;
		}
		const branch = this.footerData.getGitBranch();
		if (branch) {
			pwd = `${pwd} (${branch})`;
		}
		const sessionName = this.session.sessionManager.getSessionName();
		if (sessionName) {
			pwd = `${pwd} • ${sessionName}`;
		}
		const modelName = state.model?.id || "no-model";
		let rightSide = modelName;
		if (state.model?.reasoning) {
			const thinkingLevel = state.thinkingLevel || "off";
			rightSide = thinkingLevel === "off" ? `${modelName} • thinking off` : `${modelName} • ${thinkingLevel}`;
		}
		if (this.footerData.getAvailableProviderCount() > 1 && state.model) {
			rightSide = `(${state.model!.provider}) ${rightSide}`;
		}
		const pwdWidth = visibleWidth(pwd);
		const rightSideWidth = visibleWidth(rightSide);
		const minPadding = 2;
		let statusLine: string;
		if (pwdWidth + minPadding + rightSideWidth <= width) {
			const padding = " ".repeat(width - pwdWidth - rightSideWidth);
			statusLine = pwd + padding + rightSide;
		} else {
			const availableForRight = width - pwdWidth - minPadding;
			if (availableForRight > 0) {
				const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
				const truncatedRightWidth = visibleWidth(truncatedRight);
				const padding = " ".repeat(Math.max(0, width - pwdWidth - truncatedRightWidth));
				statusLine = pwd + padding + truncatedRight;
			} else {
				statusLine = pwd;
			}
		}
		const lines = [theme.fg("dim", statusLine)];
		const extensionStatuses = this.footerData.getExtensionStatuses();
		if (extensionStatuses.size > 0) {
			const sortedStatuses = Array.from(extensionStatuses.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([, text]) => sanitizeStatusText(text));
			const statusLine = sortedStatuses.join(" ");
			lines.push(truncateToWidth(statusLine, width, theme.fg("dim", "...")));
		}
		return lines;
	}
}
