import {Element, TextNode} from "parse5";

export default class ElementListHelper extends Array<Element> {
	public getTextValues = (): string[] => {
		return this.map((node) => {
			const childNodeAsElement = node as any as Element;
			return (childNodeAsElement?.childNodes[0] as TextNode).value.replace(/\n/, "").trim();
		});
	}

	public getThChildNode = (index: number): ElementListHelper => {
		const elementListHelper = new ElementListHelper();
		this.forEach((node) => {
			elementListHelper.push((node.childNodes as any[] as Element[])
				.filter((subNode: Element) => !subNode.nodeName?.startsWith("#"))[index]);
		});
		return elementListHelper;
	}
}
