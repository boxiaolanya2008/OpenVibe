import { existsSync, type FSWatcher, readFileSync, statSync, watch } from "fs";
import { dirname, join, resolve } from "path";

function findGitHeadPath(): string | null {
	let dir = process.cwd();
	while (true) {
		const gitPath = join(dir, ".git");
		if (existsSync(gitPath)) {
			try {
				const stat = statSync(gitPath);
				if (stat.isFile()) {
					const content = readFileSync(gitPath, "utf8").trim();
					if (content.startsWith("gitdir: ")) {
						const gitDir = content.slice(8);
						const headPath = resolve(dir, gitDir, "HEAD");
						if (existsSync(headPath)) return headPath;
					}
				} else if (stat.isDirectory()) {
					const headPath = join(gitPath, "HEAD");
					if (existsSync(headPath)) return headPath;
				}
			} catch {
				return null;
			}
		}
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}
export class FooterDataProvider {
	private extensionStatuses = new Map<string, string>();
	private cachedBranch: string | null | undefined = undefined;
	private gitWatcher: FSWatcher | null = null;
	private branchChangeCallbacks = new Set<() => void>();
	private availableProviderCount = 0;
	constructor() {
		this.setupGitWatcher();
	}
	getGitBranch(): string | null {
		if (this.cachedBranch !== undefined) return this.cachedBranch;
		try {
			const gitHeadPath = findGitHeadPath();
			if (!gitHeadPath) {
				this.cachedBranch = null;
				return null;
			}
			const content = readFileSync(gitHeadPath, "utf8").trim();
			this.cachedBranch = content.startsWith("ref: refs/heads/") ? content.slice(16) : "detached";
		} catch {
			this.cachedBranch = null;
		}
		return this.cachedBranch;
	}
	getExtensionStatuses(): ReadonlyMap<string, string> {
		return this.extensionStatuses;
	}
	onBranchChange(callback: () => void): () => void {
		this.branchChangeCallbacks.add(callback);
		return () => this.branchChangeCallbacks.delete(callback);
	}
	setExtensionStatus(key: string, text: string | undefined): void {
		if (text === undefined) {
			this.extensionStatuses.delete(key);
		} else {
			this.extensionStatuses.set(key, text);
		}
	}
	clearExtensionStatuses(): void {
		this.extensionStatuses.clear();
	}
	getAvailableProviderCount(): number {
		return this.availableProviderCount;
	}
	setAvailableProviderCount(count: number): void {
		this.availableProviderCount = count;
	}
	dispose(): void {
		if (this.gitWatcher) {
			this.gitWatcher.close();
			this.gitWatcher = null;
		}
		this.branchChangeCallbacks.clear();
	}
	private setupGitWatcher(): void {
		if (this.gitWatcher) {
			this.gitWatcher.close();
			this.gitWatcher = null;
		}
		const gitHeadPath = findGitHeadPath();
		if (!gitHeadPath) return;
		const gitDir = dirname(gitHeadPath);
		try {
			this.gitWatcher = watch(gitDir, (_eventType, filename) => {
				if (filename === "HEAD") {
					this.cachedBranch = undefined;
					for (const cb of this.branchChangeCallbacks) cb();
				}
			});
		} catch {}
	}
}
export type ReadonlyFooterDataProvider = Pick<
	FooterDataProvider,
	"getGitBranch" | "getExtensionStatuses" | "getAvailableProviderCount" | "onBranchChange"
>;
