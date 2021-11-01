import {InsightDataset, InsightDatasetKind} from "./IInsightFacade";

const validCoursesMKeys = ["avg", "pass", "fail", "audit", "year"];
const validRoomsMKeys = ["lat", "lon", "seats"];
const validCoursesSKeys = ["dept", "id", "instructor", "title", "uuid"];
const validRoomsSKeys = ["fullname", "shortname", "number", "name", "address", "type", "furniture", "href"];
const validCoursesKeys = [...validCoursesMKeys, ...validCoursesSKeys];
const validRoomsKeys = [...validRoomsMKeys, ...validRoomsSKeys];
const validMKeys = [...validCoursesMKeys, ...validRoomsMKeys];
const validSKeys = [...validCoursesSKeys, ...validRoomsSKeys];
const validKeys = [...validMKeys, ...validSKeys];
const validActionKeys = ["MAX", "MIN", "AVG", "COUNT", "SUM"];
const validOperatorKeys = ["AND", "OR", "LT", "GT", "EQ", "IS", "NOT"];

export default class QueryValidatorHelper {

	private datasetIds: string[] = []
	private datasets: InsightDataset[] = []
	private usedDatasets: string[] = []
	private usedTransformationColumns: string[] = []
	private usedGroupColumns: string[] = []
	private usedKeys: string[] = []

	constructor(datasets: InsightDataset[]) {
		this.datasetIds = datasets.map((dataset) => dataset.id);
		this.datasets = datasets;
	}

	private updateUsedDatasetsAndKeys = (key: string): void => {
		if (key.split("_").length > 1) {
			if (!this.usedDatasets.includes(key.split("_")[0])) {
				this.usedDatasets.push(key.split("_")[0]);
			}
			this.usedKeys.push(key.split("_")[1]);
		}
	}

	private keyValidator = (key: string, validTempKeys: string[]): boolean => {
		const index = validTempKeys.findIndex((validKey) => validKey === key.split("_")[1]);
		this.updateUsedDatasetsAndKeys(key);
		return index !== -1;
	}

	private mKeyValidator = (key: string): boolean => {
		return this.keyValidator(key, validMKeys);
	}

	private sKeyValidator = (key: string): boolean => {
		return this.keyValidator(key, validSKeys);
	}

	private logicComparatorValidator = (query: any): boolean => {
		return !(!Array.isArray(query) ||
				query.length === 0 ||
				query.some((subQuery) => Object.keys(subQuery).length !== 1))
			&& query.every((subQuery) => this.whereValidator(subQuery));
	}

	private mComparatorValidator = (query: any): boolean => {
		return (query instanceof Object && !Array.isArray(query)) &&
			Object.keys(query).length === 1 && typeof query[Object.keys(query)[0]] === "number" &&
			this.mKeyValidator(Object.keys(query)[0]);
	}

	private sComparatorFormatValidator = (search: string): boolean => {
		let searchString = String(search);
		if (search.startsWith("*")) {
			searchString = searchString.slice(1, searchString.length);
		}
		if (search.endsWith("*")) {
			searchString = searchString.slice(0, searchString.length - 1);
		}
		return !searchString.includes("*");
	}

	private sComparatorValidator = (query: any): boolean => {
		return (query instanceof Object && !Array.isArray(query)) &&
			Object.keys(query).length === 1 && typeof query[Object.keys(query)[0]] === "string" &&
			this.sComparatorFormatValidator(query[Object.keys(query)[0]]) &&
			this.sKeyValidator(Object.keys(query)[0]);
	}

	private negationComparatorValidator = (query: any): boolean => {
		return (query instanceof Object && !Array.isArray(query)) &&
			Object.keys(query).length === 1 && this.whereValidator(query);
	}

	private whereValidator = (query: any): boolean => {
		if (!(query instanceof Object && !Array.isArray(query))) {
			return false;
		}
		const keys = Object.keys(query);
		let mainKey: string = "";
		for (const requiredKey of validOperatorKeys) {
			const index = keys.findIndex((key) => key === requiredKey);
			if (index !== -1) {
				mainKey = requiredKey;
				keys.splice(index, 1);
				break;
			}
		}
		let pred: boolean = true;
		if (["AND", "OR"].some((key) => key === mainKey)) {
			pred = this.logicComparatorValidator(query[mainKey]);
		} else if (["LT", "GT", "EQ"].some((key) => key === mainKey)) {
			pred = this.mComparatorValidator(query[mainKey]);
		} else if (mainKey === "IS") {
			pred = this.sComparatorValidator(query[mainKey]);
		} else if (mainKey === "NOT") {
			pred = this.negationComparatorValidator(query[mainKey]);
		}
		return keys.length === 0 && pred;
	}

	private orderKeyChecker = (query: any, col: string): boolean => {
		this.updateUsedDatasetsAndKeys(col);
		const key = col.split("_")[1];
		if (!(validKeys.includes(key) || this.usedTransformationColumns.includes(col))) {
			return false;
		}
		return !(Array.isArray(query["COLUMNS"]) && !query["COLUMNS"].includes(col));
	}

	private optionsValidator = (query: any): boolean => {
		if (!(query instanceof Object && !Array.isArray(query))) {
			return false;
		}
		const keys = Object.keys(query);
		const columnsIndex = keys.findIndex((key) => key === "COLUMNS");
		if (columnsIndex !== -1) {
			keys.splice(columnsIndex, 1);
		} else {
			return false;
		}
		const orderIndex = keys.findIndex((key) => key === "ORDER");
		if (orderIndex !== -1) {
			keys.splice(orderIndex, 1);
		}
		if (query["ORDER"] !== undefined) {
			if (typeof query["ORDER"] === "string") {
				if (!this.orderKeyChecker(query, query["ORDER"])) {
					return false;
				}
			} else if (query["ORDER"] instanceof Object && !Array.isArray(query["ORDER"])) {
				if (!(query["ORDER"]["dir"] === "DOWN" || query["ORDER"]["dir"] === "UP")) {
					return false;
				}
				if (!Array.isArray(query["ORDER"]["keys"]) || query["ORDER"]["keys"].length === 0) {
					return false;
				}
				for (const col of query["ORDER"]["keys"]) {
					if (!(typeof (col as any) === "string" && this.orderKeyChecker(query, col))) {
						return false;
					}
				}
			} else {
				return false;
			}
		}
		return keys.length === 0 &&
			Array.isArray(query["COLUMNS"]) &&
			query["COLUMNS"].length > 0 &&
			query["COLUMNS"].every((column: any) => {
				this.updateUsedDatasetsAndKeys(column);
				const key = column.split("_")[1];
				if (this.usedGroupColumns.length > 0) {
					return this.usedGroupColumns.includes(column) || this.usedTransformationColumns.includes(column);
				}
				return validKeys.includes(key);
			});
	}

	private transformationValidator = (query: any): boolean => {
		if (!(query instanceof Object && !Array.isArray(query))) {
			return false;
		}
		const keys = Object.keys(query);
		const requiredKeys = ["GROUP", "APPLY"];
		for (const requiredKey of requiredKeys) {
			const index = keys.findIndex((key) => key === requiredKey);
			if (index === -1) {
				return false;
			} else {
				keys.splice(index, 1);
			}
		}
		const groupingValidation = query["GROUP"].every((column: any) => {
			this.updateUsedDatasetsAndKeys(column);
			const key = column.split("_")[1];
			return validKeys.includes(key);
		});
		if (!groupingValidation) {
			return false;
		}
		this.usedGroupColumns = query["GROUP"];
		for (const action of query["APPLY"]) {
			const actionKeys = Object.keys(action);
			if (actionKeys.length !== 1) {
				return false;
			}
			const specialKey = actionKeys[0], actionKey = Object.keys(action[specialKey]),
				datasetKey = action[specialKey][actionKey[0]];
			this.updateUsedDatasetsAndKeys(datasetKey);
			if (
				actionKey.length !== 1 ||
				!validActionKeys.includes(actionKey[0]) ||
				!this.datasetIds.includes(datasetKey.split("_")[0]) ||
				(actionKey[0] === "COUNT" ?
					!validKeys.includes(datasetKey.split("_")[1]) :
					!validMKeys.includes(datasetKey.split("_")[1])) ||
				this.usedTransformationColumns.includes(specialKey)
			) {
				return false;
			}
			this.usedTransformationColumns.push(specialKey);
		}
		return keys.length === 0;
	}

	public queryValidator = (query: any): string | false => {
		if (!(query instanceof Object && !Array.isArray(query))) {
			return false;
		}
		const keys = Object.keys(query);
		const requiredKeys = ["WHERE", "OPTIONS"];
		const optionalKeys = ["TRANSFORMATIONS"];
		for (const requiredKey of requiredKeys) {
			const index = keys.findIndex((key) => key === requiredKey);
			if (index === -1) {
				return false;
			} else {
				keys.splice(index, 1);
			}
		}
		for (const requiredKey of optionalKeys) {
			const index = keys.findIndex((key) => key === requiredKey);
			if (index !== -1) {
				keys.splice(index, 1);
			}
		}
		if (query["TRANSFORMATIONS"]) {
			if (!this.transformationValidator(query["TRANSFORMATIONS"])) {
				return false;
			}
		}
		const whereValidatorResult = this.whereValidator(query["WHERE"]);
		const optionsValidatorResult = this.optionsValidator(query["OPTIONS"]);
		if (this.usedDatasets.length > 1) {
			return false;
		} else if (this.usedDatasets.length === 1) {
			if (!this.datasetIds.includes(this.usedDatasets[0])) {
				return false;
			}
		}
		if (!(keys.length === 0 && whereValidatorResult && optionsValidatorResult)) {
			return false;
		}
		return this.usedDatasets[0];
	}
}
