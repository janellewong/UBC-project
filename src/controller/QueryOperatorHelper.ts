import {ResultTooLargeError} from "./IInsightFacade";
import {DatasetData} from "./InsightFacade";

const mapper: any = {
	avg: "Avg",
	pass: "Pass",
	fail: "Fail",
	audit: "Audit",
	year: "Year",
	dept: "Subject",
	id: "Course",
	instructor: "Professor",
	title: "Title",
	uuid: "id",
};

export default class QueryOperatorHelper {

	private datasets: DatasetData[];

	constructor(dataInDatasets: DatasetData[]) {
		this.datasets = dataInDatasets;
	}

	private getDataset = (datasetId: string): any[] => {
		const index = this.datasets.findIndex((dataset) => dataset.id === datasetId);
		return this.datasets[index].results;
	}

	private getCommon = (arr1: any[], arr2: any[]) => {
		return arr1.filter((elem) => arr2.indexOf(elem) !== -1);
	}

	private eqOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		const mKey = key.split("_")[1];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[mapper[mKey]] !== query[key] : data[mapper[mKey]] === query[key];
		});
	}

	private gtOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		const mKey = key.split("_")[1];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[mapper[mKey]] <= query[key] : data[mapper[mKey]] > query[key];
		});
	}

	private ltOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		const mKey = key.split("_")[1];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[mapper[mKey]] >= query[key] : data[mapper[mKey]] < query[key];
		});
	}

	private andOperator = async (queries: any[], isNegated: boolean): Promise<any[]> => {
		const results = await Promise.all(queries.map((query) => {
			return this.filterOperator(query, isNegated);
		}));
		let finalArray = results[0];
		for (let i = 1; i < results.length; i++) {
			finalArray = this.getCommon(finalArray, results[i]);
		}
		return finalArray;
	}

	private orOperator = async (queries: any[], isNegated: boolean): Promise<any[]> => {
		const results = await Promise.all(queries.map((query) => {
			return this.filterOperator(query, isNegated);
		}));
		let finalArray: any[] = [];
		for (const item of isNegated ? results : results.reverse()) {
			finalArray = finalArray.concat(item);
		}
		return [...new Set(finalArray)];
	}

	private notOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		return this.filterOperator(query, !isNegated);
	}

	private isOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		const sKey = key.split("_")[1];
		return this.getDataset(dataset).filter((data) => {
			const strToCheck: string = query[key];
			const updatedStr = strToCheck.replace(/\*/g, "");
			if (strToCheck.startsWith("*") && strToCheck.endsWith("*")) {
				return isNegated ?
					!(data[mapper[sKey]].includes(updatedStr)) :
					data[mapper[sKey]].includes(updatedStr);
			} else if (strToCheck.startsWith("*")) {
				return isNegated ?
					!(data[mapper[sKey]].endsWith(updatedStr)) :
					data[mapper[sKey]].endsWith(updatedStr);
			} else if (strToCheck.endsWith("*")) {
				return isNegated ?
					!(data[mapper[sKey]].startsWith(updatedStr)) :
					data[mapper[sKey]].startsWith(updatedStr);
			} else {
				return isNegated ?
					!(updatedStr === data[mapper[sKey]]) :
					updatedStr === data[mapper[sKey]];
			}
		});
	}


	private filterOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		const operator = Object.keys(query)[0];
		switch (operator) {
			case "EQ":
				return this.eqOperator(query[operator], isNegated);
			case "GT":
				return this.gtOperator(query[operator], isNegated);
			case "LT":
				return this.ltOperator(query[operator], isNegated);
			case "AND":
				if (isNegated) {
					return this.orOperator(query[operator], isNegated);
				}
				return this.andOperator(query[operator], isNegated);
			case "OR":
				if (isNegated) {
					return this.andOperator(query[operator], isNegated);
				}
				return this.orOperator(query[operator], isNegated);
			case "NOT":
				return this.notOperator(query[operator], isNegated);
			case "IS":
				return this.isOperator(query[operator], isNegated);
			default:
				throw new ResultTooLargeError();
		}
	}

	public queryAggregator = async (query: any): Promise<any[]> => {
		const where = query.WHERE;
		const options = query.OPTIONS;
		const result = await this.filterOperator(where, false);
		if (result.length > 5000) {
			throw new ResultTooLargeError();
		}
		const mappedResult = result.map((courses) => {
			const updatedResult: any = {};
			for (const key of options.COLUMNS) {
				const dataset = key.split("_")[0];
				const splitKey = key.split("_")[1];
				updatedResult[`${dataset}_${splitKey}`] = courses[mapper[splitKey]];
				if (splitKey === "uuid") {
					updatedResult[`${dataset}_uuid`] = String(courses[mapper["uuid"]]);
				} else if (splitKey === "year") {
					if (courses["Section"] === "overall") {
						updatedResult[`${dataset}_year`] = 1900;
					} else {
						updatedResult[`${dataset}_year`] = Number(courses[mapper["year"]]);
					}
				}
			}
			return updatedResult;
		});
		if (options.ORDER) {
			if (typeof options.ORDER === "string") {
				return mappedResult.sort(this.orderSort(options.ORDER));
			} else {
				let res = mappedResult;
				for (const key of options.ORDER.keys.reverse()) {
					res = res.sort(this.orderSort(key, options.ORDER.dir));
				}
				return res;
			}
		} else {
			return mappedResult;
		}
	}

	private orderSort = (order: string, pos: string = "UP") => {
		return (courseA: Record<string, string | number>, courseB: Record<string, string | number>) => {
			const dataset = order.split("_")[0];
			const splitKey = order.split("_")[1];
			if (courseA[`${dataset}_${splitKey}`] > courseB[`${dataset}_${splitKey}`]) {
				return pos === "DOWN" ? -1 : 1;
			} else if (courseA[`${dataset}_${splitKey}`] < courseB[`${dataset}_${splitKey}`]) {
				return pos === "DOWN" ? 1 : -1;
			} else {
				return 0;
			}
		};
	}
}
