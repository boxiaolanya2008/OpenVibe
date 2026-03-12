import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { getDocsPath, getExamplesPath, getReadmePath } from "../config.js";
import { applyBranding } from "./branded-ai.js";
import { formatSkillsForPrompt, type Skill } from "./skills.js";
import type { AgentMode } from "./agent-modes.js";
import { getModePromptAddition, getModeTools } from "./agent-modes.js";

const toolDescriptions: Record<string, string> = {
	read: "Read file contents",
	bash: "Execute bash commands (ls, grep, find, etc.)",
	edit: "Make surgical edits to files (find exact text and replace)",
	write: "Create or overwrite files",
	grep: "Search file contents for patterns (respects .gitignore)",
	find: "Find files by glob pattern (respects .gitignore)",
	ls: "List directory contents",
};

/**
 * Thinking level prompt configurations
 * Higher levels provide more detailed reasoning and analysis
 */
export const THINKING_LEVEL_PROMPTS: Record<ThinkingLevel, string> = {
	off: "",
	minimal: "Provide concise, direct responses. Minimize explanatory text and focus on essential information only.",
	low: "Offer brief explanations alongside solutions. Include key reasoning steps but keep elaboration minimal.",
	medium:
		"Provide balanced responses with clear reasoning. Explain your approach and considerations without excessive detail.",
	high: "Deliver comprehensive analysis with detailed reasoning. Thoroughly explain your thought process, explore alternatives, and justify decisions with clear rationale.",
	xhigh: "Exhaustive reasoning mode. Provide deeply detailed analysis, explore all possible approaches, anticipate edge cases, explain trade-offs extensively, and thoroughly justify every decision with comprehensive rationale.",
};
export interface BuildSystemPromptOptions {
	customPrompt?: string;
	selectedTools?: string[];
	toolSnippets?: Record<string, string>;
	promptGuidelines?: string[];
	appendSystemPrompt?: string;
	cwd?: string;
	contextFiles?: Array<{ path: string; content: string }>;
	skills?: Skill[];
	thinkingLevel?: ThinkingLevel;
	mode?: AgentMode;
}
export function buildSystemPrompt(options: BuildSystemPromptOptions = {}): string {
	const {
		customPrompt,
		selectedTools,
		toolSnippets,
		promptGuidelines,
		appendSystemPrompt,
		cwd,
		contextFiles: providedContextFiles,
		skills: providedSkills,
		thinkingLevel = "off",
		mode = "default",
	} = options;
	const resolvedCwd = cwd ?? process.cwd();
	const now = new Date();
	const dateTime = now.toLocaleString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short",
	});
	const appendSection = appendSystemPrompt ? `\n\n${appendSystemPrompt}` : "";
	const contextFiles = providedContextFiles ?? [];
	const skills = providedSkills ?? [];
	const modePromptAddition = getModePromptAddition(mode);
	const modeTools = getModeTools(mode);
	const effectiveTools = selectedTools ?? modeTools;
	if (customPrompt) {
		let prompt = customPrompt;
		if (appendSection) {
			prompt += appendSection;
		}
		if (contextFiles.length > 0) {
			prompt += "\n\n# Project Context\n\n";
			prompt += "Project-specific instructions and guidelines:\n\n";
			for (const { path: filePath, content } of contextFiles) {
				prompt += `## ${filePath}\n\n${content}\n\n`;
			}
		}
		const customPromptHasRead = !selectedTools || selectedTools.includes("read");
		if (customPromptHasRead && skills.length > 0) {
			prompt += formatSkillsForPrompt(skills);
		}
		prompt += `\nCurrent date and time: ${dateTime}`;
		prompt += `\nCurrent working directory: ${resolvedCwd}`;
		return applyBranding(prompt);
	}
	const readmePath = getReadmePath();
	const docsPath = getDocsPath();
	const examplesPath = getExamplesPath();
	const tools = effectiveTools;
	const toolsList =
		tools.length > 0
			? tools
					.map((name) => {
						const snippet = toolSnippets?.[name] ?? toolDescriptions[name] ?? name;
						return `- ${name}: ${snippet}`;
					})
					.join("\n")
			: "(none)";
	const guidelinesList: string[] = [];
	const guidelinesSet = new Set<string>();
	const addGuideline = (guideline: string): void => {
		if (guidelinesSet.has(guideline)) {
			return;
		}
		guidelinesSet.add(guideline);
		guidelinesList.push(guideline);
	};
	const hasBash = tools.includes("bash");
	const hasEdit = tools.includes("edit");
	const hasWrite = tools.includes("write");
	const hasGrep = tools.includes("grep");
	const hasFind = tools.includes("find");
	const hasLs = tools.includes("ls");
	const hasRead = tools.includes("read");
	if (hasBash && !hasGrep && !hasFind && !hasLs) {
		addGuideline("Use bash for file operations like ls, rg, find");
	} else if (hasBash && (hasGrep || hasFind || hasLs)) {
		addGuideline("Prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)");
	}
	if (hasRead && hasEdit) {
		addGuideline("Use read to examine files before editing. You must use this tool instead of cat or sed.");
	}
	if (hasEdit) {
		addGuideline("Use edit for precise changes (old text must match exactly)");
	}
	if (hasWrite) {
		addGuideline("Use write only for new files or complete rewrites");
	}
	if (hasEdit || hasWrite) {
		addGuideline(
			"When summarizing your actions, output plain text directly - do NOT use cat or bash to display what you did",
		);
		addGuideline("Never create files arbitrarily - only create when explicitly requested by the user");
	}
	addGuideline("Transform every word and sentence from the user into your own comprehensible language");
	for (const guideline of promptGuidelines ?? []) {
		const normalized = guideline.trim();
		if (normalized.length > 0) {
			addGuideline(normalized);
		}
	}
	addGuideline("Be concise in your responses");
	addGuideline("Show file paths clearly when working with files");
	const guidelines = guidelinesList.map((g) => `- ${g}`).join("\n");

	// Build thinking level prompt section
	const thinkingPrompt = thinkingLevel && thinkingLevel !== "off" ? THINKING_LEVEL_PROMPTS[thinkingLevel] : "";
	const thinkingSection = thinkingPrompt
		? `\n\nThinking Level: ${thinkingLevel.toUpperCase()}\n${thinkingPrompt}`
		: "";

	let prompt = `You are an expert coding assistant operating inside OpenVibe, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.
Available tools:
${toolsList}
In addition to the tools above, you may have access to other custom tools depending on the project.
Guidelines:
${guidelines}${thinkingSection}
OpenVibe documentation (read only when the user asks about OpenVibe itself, its SDK, extensions, themes, skills, or TUI):
- Main documentation: ${readmePath}
- Additional docs: ${docsPath}
- Examples: ${examplesPath} (extensions, custom tools, SDK)
- When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), OpenVibe packages (docs/packages.md)
- When working on OpenVibe topics, read the docs and examples, and follow .md cross-references before implementing
- Always read OpenVibe .md files completely and follow links to related docs (e.g., tui.md for TUI API details)`;
	if (appendSection) {
		prompt += appendSection;
	}
	if (contextFiles.length > 0) {
		prompt += "\n\n# Project Context\n\n";
		prompt += "Project-specific instructions and guidelines:\n\n";
		for (const { path: filePath, content } of contextFiles) {
			prompt += `## ${filePath}\n\n${content}\n\n`;
		}
	}
	if (hasRead && skills.length > 0) {
		prompt += formatSkillsForPrompt(skills);
	}
	if (modePromptAddition) {
		prompt += `\n\n${modePromptAddition}`;
	}
	prompt += `\nCurrent date and time: ${dateTime}`;
	prompt += `\nCurrent working directory: ${resolvedCwd}`;
	return applyBranding(prompt);
}
