import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";

const CACHE_DIR = join(homedir(), ".openvibe");
const CACHE_FILE = join(CACHE_DIR, "version-check.json");
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface VersionCache {
	lastCheck: number;
	latestVersion: string;
}

function getCurrentVersion(): string {
	// Read version from package.json
	try {
		const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));
		return pkg.version;
	} catch {
		return "0.0.0";
	}
}

function parseVersion(version: string): number[] {
	return version.split(".").map((v) => parseInt(v, 10));
}

function isNewer(current: string, latest: string): boolean {
	const currentParts = parseVersion(current);
	const latestParts = parseVersion(latest);
	
	for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
		const currentPart = currentParts[i] || 0;
		const latestPart = latestParts[i] || 0;
		if (latestPart > currentPart) return true;
		if (latestPart < currentPart) return false;
	}
	return false;
}

async function fetchLatestVersion(): Promise<string | null> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		
		const response = await fetch("https://registry.npmjs.org/openvibe", {
			signal: controller.signal,
		});
		clearTimeout(timeout);
		
		if (!response.ok) return null;
		
		const data = await response.json() as { "dist-tags"?: { latest?: string } };
		return data["dist-tags"]?.latest || null;
	} catch {
		return null;
	}
}

function readCache(): VersionCache | null {
	try {
		if (!existsSync(CACHE_FILE)) return null;
		const content = readFileSync(CACHE_FILE, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function writeCache(cache: VersionCache): void {
	try {
		if (!existsSync(CACHE_DIR)) {
			mkdirSync(CACHE_DIR, { recursive: true });
		}
		writeFileSync(CACHE_FILE, JSON.stringify(cache));
	} catch {
		// Ignore cache write errors
	}
}

export async function checkForUpdates(): Promise<void> {
	const currentVersion = getCurrentVersion();
	const cache = readCache();
	const now = Date.now();
	
	let latestVersion: string | null;
	
	// Use cached version if checked recently
	if (cache && now - cache.lastCheck < CHECK_INTERVAL) {
		latestVersion = cache.latestVersion;
	} else {
		// Fetch from npm registry
		latestVersion = await fetchLatestVersion();
		if (latestVersion) {
			writeCache({ lastCheck: now, latestVersion });
		}
	}
	
	if (latestVersion && isNewer(currentVersion, latestVersion)) {
		console.log();
		console.log(chalk.yellow("┌─────────────────────────────────────────────────────────┐"));
		console.log(chalk.yellow("│") + "  " + chalk.bold("Update Available") + "                                         " + chalk.yellow("│"));
		console.log(chalk.yellow("│") + `  Current: ${chalk.gray(currentVersion)}` + "                                         " + chalk.yellow("│"));
		console.log(chalk.yellow("│") + `  Latest:  ${chalk.green(latestVersion)}` + "                                          " + chalk.yellow("│"));
		console.log(chalk.yellow("│") + "                                                          " + chalk.yellow("│"));
		console.log(chalk.yellow("│") + "  Run " + chalk.cyan("npm i -g openvibe") + " to update                     " + chalk.yellow("│"));
		console.log(chalk.yellow("└─────────────────────────────────────────────────────────┘"));
		console.log();
	}
}
