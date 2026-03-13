import { Container, SelectList, Spacer, Text } from "@mariozechner/pi-tui";
import type { Skill } from "../../../core/skills.js";
import { getSelectListTheme, theme } from "../theme/theme.js";

export interface SkillsSelectorCallbacks {
	onSelect: (skill: Skill) => void;
	onCancel: () => void;
}

export class SkillsSelectorComponent extends Container {
	private selectList: SelectList;
	private skills: Skill[];

	constructor(skills: Skill[], callbacks: SkillsSelectorCallbacks) {
		super();
		this.skills = skills;

		// Header
		this.addChild(new Text(theme.bold(theme.fg("accent", "Skills")), 0, 0));
		this.addChild(new Spacer(1));

		if (skills.length === 0) {
			this.addChild(new Text(theme.fg("warning", "No skills available."), 0, 0));
			this.addChild(new Spacer(1));
			this.addChild(new Text(theme.fg("dim", "Skills can be added to:"), 0, 0));
			this.addChild(new Text(theme.fg("muted", "  ~/.openvibe/skills/   (global)"), 0, 0));
			this.addChild(new Text(theme.fg("muted", "  .openvibe/skills/     (project)"), 0, 0));
			this.addChild(new Spacer(1));
			this.addChild(new Text(theme.fg("dim", "Press Esc to go back"), 0, 0));
			this.selectList = new SelectList([], 1, getSelectListTheme());
			this.selectList.onCancel = callbacks.onCancel;
			this.addChild(this.selectList);
			return;
		}

		this.addChild(new Text(theme.fg("dim", "Select a skill to load and invoke it."), 0, 0));
		this.addChild(new Spacer(1));

		// Create select items
		const items = skills.map((skill) => ({
			label: skill.name,
			value: skill.name,
		}));

		this.selectList = new SelectList(items, Math.min(items.length, 15), getSelectListTheme());

		this.selectList.onSelect = (item) => {
			const skill = this.skills.find((s) => s.name === item.value);
			if (skill) {
				callbacks.onSelect(skill);
			}
		};

		this.selectList.onCancel = callbacks.onCancel;

		this.addChild(this.selectList);

		// Footer hints
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", "  Enter to select · Esc to go back"), 0, 0));
	}

	handleInput(data: string): void {
		this.selectList.handleInput(data);
	}
}
