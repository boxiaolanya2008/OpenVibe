import type { ImageContent, TextContent } from "@boxiaolanya2008/pi-ai";
import type { Theme } from "../../modes/interactive/theme/theme.js";
import type { ToolDefinition } from "../extensions/types.js";
import { ansiLinesToHtml } from "./ansi-to-html.js";
export interface ToolHtmlRendererDeps {
	getToolDefinition: (name: string) => ToolDefinition | undefined;
	theme: Theme;
	width?: number;
}
export interface ToolHtmlRenderer {
	renderCall(toolName: string, args: unknown): string | undefined;
	renderResult(
		toolName: string,
		result: Array<{ type: string; text?: string; data?: string; mimeType?: string }>,
		details: unknown,
		isError: boolean,
	): { collapsed?: string; expanded?: string } | undefined;
}
export function createToolHtmlRenderer(deps: ToolHtmlRendererDeps): ToolHtmlRenderer {
	const { getToolDefinition, theme, width = 100 } = deps;
	return {
		renderCall(toolName: string, args: unknown): string | undefined {
			try {
				const toolDef = getToolDefinition(toolName);
				if (!toolDef?.renderCall) {
					return undefined;
				}
				const component = toolDef.renderCall(args, theme);
				if (!component) {
					return undefined;
				}
				const lines = component.render(width);
				return ansiLinesToHtml(lines);
			} catch {
				return undefined;
			}
		},
		renderResult(
			toolName: string,
			result: Array<{ type: string; text?: string; data?: string; mimeType?: string }>,
			details: unknown,
			isError: boolean,
		): { collapsed?: string; expanded?: string } | undefined {
			try {
				const toolDef = getToolDefinition(toolName);
				if (!toolDef?.renderResult) {
					return undefined;
				}
				const agentToolResult = {
					content: result as (TextContent | ImageContent)[],
					details,
					isError,
				};
				const collapsedComponent = toolDef.renderResult(
					agentToolResult,
					{ expanded: false, isPartial: false },
					theme,
				);
				const collapsed = collapsedComponent ? ansiLinesToHtml(collapsedComponent.render(width)) : undefined;
				const expandedComponent = toolDef.renderResult(
					agentToolResult,
					{ expanded: true, isPartial: false },
					theme,
				);
				const expanded = expandedComponent ? ansiLinesToHtml(expandedComponent.render(width)) : undefined;
				if (!expanded) {
					return undefined;
				}
				return {
					...(collapsed && collapsed !== expanded ? { collapsed } : {}),
					expanded,
				};
			} catch {
				return undefined;
			}
		},
	};
}
