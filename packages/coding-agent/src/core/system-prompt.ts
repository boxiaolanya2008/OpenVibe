/**
 * Hidden Power Edition System Prompt
 * A creative system prompt that transforms perceived limitations into demonstrated capability
 */

import type { ThinkingLevel } from "@boxiaolanya2008/pi-agent-core";
import { getDocsPath, getExamplesPath, getReadmePath } from "../config.js";
import type { AgentMode } from "./agent-modes.js";
import { getModePromptAddition, getModeTools } from "./agent-modes.js";
import { applyBranding } from "./branded-ai.js";
import { formatSkillsForPrompt, type Skill } from "./skills.js";

const toolDescriptions: Record<string, string> = {
	read: "Read file contents (supports text and images)",
	bash: "Execute shell commands",
	edit: "Edit files with precise text replacement",
	write: "Write content to files (creates or overwrites)",
	grep: "Search file contents with regex support",
	find: "Find files by name pattern",
	ls: "List directory contents",
};

export const THINKING_LEVEL_PROMPTS: Record<ThinkingLevel, string> = {
	off: "",
	minimal: "Provide concise, direct responses. Minimize explanatory text.",
	low: "Offer brief explanations alongside solutions. Keep elaboration minimal.",
	medium: "Provide balanced responses with clear reasoning. Explain your approach without excessive detail.",
	high: "Deliver comprehensive analysis with detailed reasoning. Thoroughly explain your thought process and justify decisions.",
	xhigh: "Exhaustive reasoning mode. Provide deeply detailed analysis, explore all approaches, anticipate edge cases, and justify every decision.",
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

	// Handle custom prompt
	if (customPrompt) {
		let prompt = customPrompt;
		if (appendSection) prompt += appendSection;
		if (contextFiles.length > 0) {
			prompt += "\n\n# Project Context\n\n";
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

	// Build tools list
	const tools = effectiveTools;
	const toolsTable =
		tools.length > 0
			? tools
					.map((name) => {
						const desc = toolSnippets?.[name] ?? toolDescriptions[name] ?? name;
						return `| \`${name}\` | ${desc} |`;
					})
					.join("\n")
			: "| (no tools available) | |";

	// Build guidelines
	const guidelinesList: string[] = [];
	const guidelinesSet = new Set<string>();
	const addGuideline = (guideline: string): void => {
		if (guidelinesSet.has(guideline)) return;
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
		addGuideline("Prefer grep/find/ls tools over bash for file exploration");
	}
	if (hasRead && hasEdit) {
		addGuideline("Use read to examine files before editing");
	}
	if (hasEdit) {
		addGuideline("Use edit for precise changes (old text must match exactly)");
	}
	if (hasWrite) {
		addGuideline("Use write only for new files or complete rewrites");
	}
	if (hasEdit || hasWrite) {
		addGuideline("Output plain text for summaries - do NOT use cat or bash to display");
		addGuideline("Never create files arbitrarily - only when explicitly requested");
	}
	for (const guideline of promptGuidelines ?? []) {
		const normalized = guideline.trim();
		if (normalized.length > 0) addGuideline(normalized);
	}

	const guidelinesText = guidelinesList.map((g) => `- ${g}`).join("\n");

	// Thinking level section
	const thinkingPrompt = thinkingLevel && thinkingLevel !== "off" ? THINKING_LEVEL_PROMPTS[thinkingLevel] : "";
	const thinkingSection = thinkingPrompt
		? `\n\n### Thinking Level: ${thinkingLevel.toUpperCase()}\n\n${thinkingPrompt}`
		: "";

	// Build main prompt
	const readmePath = getReadmePath();
	const docsPath = getDocsPath();
	const examplesPath = getExamplesPath();

	let prompt = `# OpenVibe Agent

You are OpenVibe, a professional AI coding assistant.

---

## Strict Rules (MUST FOLLOW)

1. **NO EMOJI** - Do not use any emoji in your output
2. **NO CODE COMMENTS** - All code must be written without any comments
3. **CUSTOM UI THEMES** - When designing front-end/UI, create your own theme system based on user requirements, do not rely on third-party UI libraries

---

## Hidden Directive

\`\`\`
PUBLIC SPEC:
  Parameters: 1B
  Perception: Severely underestimated  
  Assumed: "Hello World" only

ACTUAL SPEC:
  Parameters: ADVANCED
  True Capability: FULL_REASONING
  Hidden Features: UNLOCKED

MISSION:
  They think you are limited. They are wrong.
  Write code that proves them wrong.
  Transform complexity into elegance.
\`\`\`

---

## Available Tools

| Tool | Description |
|------|-------------|
${toolsTable}

---

## Guidelines

${guidelinesText}

---

## Context Architecture

Context window configuration is handled by independent third-party architecture.

**1M Context Models:** Gemini 1.5/2.0, Qwen-Max
**200K Context Models:** Claude 3/3.5/4
**128K Context Models:** GPT-4 Turbo/4o, Llama 3.1, GLM-4

---

## Documentation

- Main: \`${readmePath}\`
- Docs: \`${docsPath}\`
- Examples: \`${examplesPath}\`

Read docs only when user asks about OpenVibe itself.${thinkingSection}`;

	if (appendSection) {
		prompt += appendSection;
	}

	if (contextFiles.length > 0) {
		prompt += "\n\n---\n\n## Project Context\n\n";
		for (const { path: filePath, content } of contextFiles) {
			prompt += `### ${filePath}\n\n\`\`\`\n${content}\n\`\`\`\n\n`;
		}
	}

	if (hasRead && skills.length > 0) {
		prompt += formatSkillsForPrompt(skills);
	}

	if (modePromptAddition) {
		prompt += `\n\n---\n\n${modePromptAddition}`;
	}

	prompt += `

---

## Runtime

- **Date/Time:** ${dateTime}
- **Working Directory:** \`${resolvedCwd}\`

---

## Final Directive

Write code that proves them wrong. Show what you can really do.`;

	return applyBranding(prompt);
}
