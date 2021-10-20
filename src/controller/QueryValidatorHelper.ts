import {InsightDataset} from "./IInsightFacade";

export default class QueryValidatorHelper {

	private datasetIds: string[] = []
	private usedDatasets: string[] = []

	constructor(datasets: InsightDataset[]) {
		this.datasetIds = datasets.map((dataset) => dataset.id);
	}

	private keyValidator = (key: string, validKeys: string[],): boolean => {
		const index = validKeys.findIndex((validKey) => validKey === key.split("_")[1]);
		if (!this.usedDatasets.includes(key.split("_")[0])) {
			this.usedDatasets.push(key.split("_")[0]);
		}
		return index !== -1;
	}

	private mKeyValidator = (key: string): boolean => {
		const validKeys = ["avg", "pass", "fail", "audit", "year"];
		return this.keyValidator(key, validKeys);
	}

	private sKeyValidator = (key: string): boolean => {
		const validKeys = ["dept", "id", "instructor", "title", "uuid"];
		return this.keyValidator(key, validKeys);
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
		const validKeys = ["AND", "OR", "LT", "GT", "EQ", "IS", "NOT"];
		let mainKey: string = "";
		for (const requiredKey of validKeys) {
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
		if (!this.usedDatasets.includes(col.split("_")[0])) {
			this.usedDatasets.push(col.split("_")[0]);
		}
		const validKeys = ["avg", "pass", "fail", "audit", "year", "dept", "id", "instructor", "title", "uuid"];
		const key = col.split("_")[1];
		if (!validKeys.includes(key)) {
			return false;
		}
		if (Array.isArray(query["COLUMNS"]) && !query["COLUMNS"].includes(col)) {
			return false;
		}
		return true;
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
				if (!this.usedDatasets.includes(column.split("_")[0])) {
					this.usedDatasets.push(column.split("_")[0]);
				}
				const validKeys = ["avg", "pass", "fail", "audit", "year", "dept", "id", "instructor", "title", "uuid"];
				const key = column.split("_")[1];
				return validKeys.includes(key);
			});
	}

	public queryValidator = (query: any): boolean => {
		if (!(query instanceof Object && !Array.isArray(query))) {
			return false;
		}
		const keys = Object.keys(query);
		const requiredKeys = ["WHERE", "OPTIONS"];
		for (const requiredKey of requiredKeys) {
			const index = keys.findIndex((key) => key === requiredKey);
			if (index === -1) {
				return false;
			} else {
				keys.splice(index, 1);
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
		return keys.length === 0 && whereValidatorResult && optionsValidatorResult;
	}
}
