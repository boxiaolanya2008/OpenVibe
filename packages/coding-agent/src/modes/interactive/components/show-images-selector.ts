import { Container, type SelectItem, SelectList } from "@mariozechner/pi-tui";
import { getSelectListTheme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
export class ShowImagesSelectorComponent extends Container {
	private selectList: SelectList;
	constructor(currentValue: boolean, onSelect: (show: boolean) => void, onCancel: () => void) {
		super();
		const items: SelectItem[] = [
			{ value: "yes", label: "Yes", description: "Show images inline in terminal" },
			{ value: "no", label: "No", description: "Show text placeholder instead" },
		];
		this.addChild(new DynamicBorder());
		this.selectList = new SelectList(items, 5, getSelectListTheme());
		this.selectList.setSelectedIndex(currentValue ? 0 : 1);
		this.selectList.onSelect = (item) => {
			onSelect(item.value === "yes");
		};
		this.selectList.onCancel = () => {
			onCancel();
		};
		this.addChild(this.selectList);
		this.addChild(new DynamicBorder());
	}
	getSelectList(): SelectList {
		return this.selectList;
	}
}
