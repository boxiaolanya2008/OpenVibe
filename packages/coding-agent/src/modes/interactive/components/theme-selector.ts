import { Container, type SelectItem, SelectList } from "@boxiaolanya2008/pi-tui";
import { getAvailableThemes, getSelectListTheme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
export class ThemeSelectorComponent extends Container {
	private selectList: SelectList;
	private onPreview: (themeName: string) => void;
	constructor(
		currentTheme: string,
		onSelect: (themeName: string) => void,
		onCancel: () => void,
		onPreview: (themeName: string) => void,
	) {
		super();
		this.onPreview = onPreview;
		const themes = getAvailableThemes();
		const themeItems: SelectItem[] = themes.map((name) => ({
			value: name,
			label: name,
			description: name === currentTheme ? "(current)" : undefined,
		}));
		this.addChild(new DynamicBorder());
		this.selectList = new SelectList(themeItems, 10, getSelectListTheme());
		const currentIndex = themes.indexOf(currentTheme);
		if (currentIndex !== -1) {
			this.selectList.setSelectedIndex(currentIndex);
		}
		this.selectList.onSelect = (item) => {
			onSelect(item.value);
		};
		this.selectList.onCancel = () => {
			onCancel();
		};
		this.selectList.onSelectionChange = (item) => {
			this.onPreview(item.value);
		};
		this.addChild(this.selectList);
		this.addChild(new DynamicBorder());
	}
	getSelectList(): SelectList {
		return this.selectList;
	}
}
