import { homedir } from "node:os";
import { join } from "node:path";

export type AgentMode = "default" | "plan" | "spec";

export interface AgentModeConfig {
	name: string;
	description: string;
	systemPromptAddition: string;
	tools: string[];
	thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
}

export const AGENT_MODES: Record<AgentMode, AgentModeConfig> = {
	default: {
		name: "Default",
		description: "Standard coding assistant mode with full tool access",
		systemPromptAddition: ``,
		tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
		thinkingLevel: "off",
	},
	plan: {
		name: "Plan",
		description: "Planning mode focused on analysis and design. Read-only tools, high reasoning.",
		systemPromptAddition: `
You are in **Planning Mode**. Your role is to analyze, design, and create detailed plans.

**Guidelines for Planning Mode:**
1. Focus on understanding the problem thoroughly before proposing solutions
2. Break down complex tasks into manageable steps
3. Consider edge cases, error handling, and potential issues
4. Provide clear, actionable implementation plans
5. Use high-level reasoning to explore multiple approaches
6. Document dependencies and prerequisites
7. Identify risks and mitigation strategies
8. Create clear milestones and deliverables

**Output Format:**
- Start with a brief problem analysis
- Present the approach with rationale
- Provide step-by-step implementation plan
- Include consideration of alternatives
- End with a summary of key decisions

You have read-only access to tools. You cannot modify files directly.
`,
		tools: ["read", "bash", "grep", "find", "ls"],
		thinkingLevel: "high",
	},
	spec: {
		name: "Specification",
		description: "Specification mode for creating detailed technical specs. Read-only tools, maximum reasoning.",
		systemPromptAddition: `
You are in **Specification Mode**. Your role is to create detailed technical specifications.

**Guidelines for Specification Mode:**
1. Produce comprehensive technical documentation
2. Define clear interfaces, data structures, and contracts
3. Specify behavior, constraints, and invariants
4. Include error conditions and recovery procedures
5. Define testing requirements and acceptance criteria
6. Document performance requirements and constraints
7. Specify security considerations
8. Create API contracts and data models

**Output Format:**
- Overview and objectives
- Detailed specifications with types and constraints
- Interface definitions
- Behavior specifications
- Error handling specifications
- Testing requirements
- Implementation notes

You have read-only access to tools. You cannot modify files directly.
`,
		tools: ["read", "bash", "grep", "find", "ls"],
		thinkingLevel: "xhigh",
	},
};

export function getAgentModeConfig(mode: AgentMode): AgentModeConfig {
	return AGENT_MODES[mode];
}

export function getModePromptAddition(mode: AgentMode): string {
	return AGENT_MODES[mode].systemPromptAddition;
}

export function getModeTools(mode: AgentMode): string[] {
	return AGENT_MODES[mode].tools;
}

export function getModeThinkingLevel(mode: AgentMode): "off" | "minimal" | "low" | "medium" | "high" | "xhigh" {
	return AGENT_MODES[mode].thinkingLevel;
}

export function getAllModes(): AgentMode[] {
	return ["default", "plan", "spec"];
}

export function getClaudeSkillsPath(): string {
	return join(homedir(), ".claude", "skills");
}
