import { AddDatasetHelper } from "./AddDatasetHelper";
import JSZip from "jszip";
import {ChildNode, Element, parse} from "parse5";
import {get} from "http";
import ElementListHelper from "./ElementListHelper";
import {InsightError} from "../IInsightFacade";

const API_URL = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team084/";

export default class AddRoomsDatasetHelper extends AddDatasetHelper {
	private getNodesWithNodeName = (documentTree: Element, elementName: string): ElementListHelper => {
		const nodes: ElementListHelper = new ElementListHelper();
		this.recursivelyFindNodesName(documentTree, elementName, nodes);
		return nodes;
	}

	private recursivelyFindNodesName = (node: Element, name: string, arr: any[]): void => {
		if (node.nodeName === name) {
			arr.push(node);
			return;
		}
		if (node.childNodes) {
			// const childNodes = node.childNodes.filter((subNode: ChildNode) => !subNode.nodeName.startsWith("#"));
			for (const child of node.childNodes) {
				this.recursivelyFindNodesName(child as any, name, arr);
			}
		}
		return;
	}

	private getNodesWithClassAttribute = (documentTree: Element, value: string): ElementListHelper => {
		const nodes: ElementListHelper = new ElementListHelper();
		this.recursivelyFindClassAttribute(documentTree, value, nodes);
		return nodes;
	}

	private recursivelyFindClassAttribute = (node: Element, value: string, arr: any[]): void => {
		if (node.attrs?.some((keyVal) => keyVal.name === "class" && keyVal.value === value)) {
			arr.push(node);
			return;
		}
		if (node.childNodes) {
			// const childNodes = node.childNodes.filter((subNode: ChildNode) => !subNode.nodeName.startsWith("#"));
			for (const child of node.childNodes) {
				this.recursivelyFindClassAttribute(child as any, value, arr);
			}
		}
		return;
	}

	private getBuildings = async (documentTree: Element): Promise<any[]> => {
		const tableNodesTree: Element[] = this.getNodesWithNodeName(documentTree, "tbody");
		let buildings: any[] = [];
		for (const tableNode of tableNodesTree) {
			const tableRowNodesTree: Element[] = this.getNodesWithNodeName(tableNode, "tr");
			for (const tableRowNodeTree of tableRowNodesTree) {
				try {
					const shortName = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-field-building-code").getTextValues()?.[0];
					const fullName = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-title"
					).getThChildNode(0)?.getTextValues()?.[0];
					const address = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-field-building-address")?.getTextValues()?.[0];
					const buildingHref = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-nothing"
					).getThChildNode(0)?.[0].attrs?.find((attr) => attr.name === "href")?.value;
					const { lat, lon } = await this.getCoordinates(address);
					buildings.push({
						fullName,
						shortName,
						address,
						lat,
						lon,
						buildingHref: buildingHref?.replace("./", "")
					});
				} catch (e) {
					// do nothing
				}
			}
		}
		return buildings;
	}

	private getRooms = (documentTree: Element, building: any, id: string): any[] => {
		const tableNodesTree: Element[] = this.getNodesWithNodeName(documentTree, "tbody");
		let rooms: any[] = [];
		for (const tableNode of tableNodesTree) {
			const tableRowNodesTree: Element[] = this.getNodesWithNodeName(tableNode, "tr");
			for (const tableRowNodeTree of tableRowNodesTree) {
				try {
					const { fullName, shortName, address, lat, lon } = building;
					const number = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-field-room-number"
					).getThChildNode(0)?.getTextValues()?.[0];
					const href = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-field-room-number"
					).getThChildNode(0)?.[0].attrs?.find((attr) => attr.name === "href")?.value;
					const seats = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-field-room-capacity").getTextValues()?.[0];
					const furniture = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-field-room-furniture").getTextValues()?.[0];
					const type = this.getNodesWithClassAttribute(
						tableRowNodeTree,
						"views-field views-field-field-room-type").getTextValues()?.[0];
					const obj: any = {};
					obj[`${id}_fullname`] = fullName;
					obj[`${id}_shortname`] = shortName;
					obj[`${id}_number`] = number;
					obj[`${id}_name`] = `${shortName}_${number}`;
					obj[`${id}_address`] = address;
					obj[`${id}_lat`] = lat;
					obj[`${id}_lon`] = lon;
					obj[`${id}_seats`] = Number(seats);
					obj[`${id}_type`] = type;
					obj[`${id}_furniture`] = furniture;
					obj[`${id}_href`] = href;
					rooms.push(obj);
				} catch (e) {
					// do nothing
				}
			}
		}
		return rooms;
	}

	private getCoordinates = (address: string): Promise<{ lat: number, lon: number }> => {
		return new Promise((resolve, reject) => {
			get(`${API_URL}/${address.replace(" ", "%20")}`, (httpResult) => {
				let JSONString: string = "";
				httpResult.on("data", (str) => {
					JSONString += str;
				});
				httpResult.on("end", () => {
					const data = JSON.parse(JSONString);
					if (data.error) {
						return reject(data.error);
					}
					return resolve(data);
				});
			});
		});
	}

	public makeResult = async (id: string, zipData: JSZip, results: any[]): Promise<void> => {
		const data = zipData.files;
		if (!data["rooms/index.htm"]) {
			throw new InsightError("Not a valid rooms dataset (no index.htm)");
		}
		const indexHTMLString = await this.streamToString(data["rooms/index.htm"].nodeStream());
		const indexHTMLTree = parse(indexHTMLString);
		const buildings = await this.getBuildings(indexHTMLTree as any as Element);
		for (const building of buildings) {
			const htmlFileLocation = `rooms/${building.buildingHref}`;
			if (data[htmlFileLocation]) {
				const buildingHTMLString = await this.streamToString(data[htmlFileLocation].nodeStream());
				const buildingHTMLTree = parse(buildingHTMLString);
				const rooms = this.getRooms(buildingHTMLTree as any as Element, building, id);
				rooms.forEach((room) => results.push(room));
			}
		}
	}
}
