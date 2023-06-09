import {ResultTooLargeError} from "./IInsightFacade";
import {DatasetData} from "./InsightFacade";
import ApplyTransformationHelper from "./ApplyTransformationHelper";

export default class QueryOperatorHelper {

	private datasets: DatasetData[];
	private dataset: string;

	constructor(dataInDatasets: DatasetData[], dataset: string) {
		this.datasets = dataInDatasets;
		this.dataset = dataset;
	}

	private getDataset = (datasetId: string): any[] => {
		const index = this.datasets.findIndex((dataset) => dataset.id === datasetId);
		return this.datasets[index].results;
	}

	private getCommon = (arr1: any[], arr2: any[]) => {
		return arr1.filter((elem) => arr2.indexOf(elem) !== -1);
	}

	private eqOperator = (query: any, isNegated: boolean): any[] => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[key] !== query[key] : data[key] === query[key];
		});
	}

	private gtOperator = (query: any, isNegated: boolean): any[] => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[key] <= query[key] : data[key] > query[key];
		});
	}

	private ltOperator = (query: any, isNegated: boolean): any[] => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[key] >= query[key] : data[key] < query[key];
		});
	}

	private andOperator = (queries: any[], isNegated: boolean): any[] => {
		const results = queries.map((query) => {
			return this.filterOperator(query, isNegated);
		});
		let finalArray = results[0];
		for (let i = 1; i < results.length; i++) {
			finalArray = this.getCommon(finalArray, results[i]);
		}
		return finalArray;
	}

	private orOperator = (queries: any[], isNegated: boolean): any[] => {
		const results = queries.map((query) => {
			return this.filterOperator(query, isNegated);
		});
		let finalArray: any[] = [];
		for (const item of isNegated ? results : results.reverse()) {
			finalArray = finalArray.concat(item);
		}
		return [...new Set(finalArray)];
	}

	private notOperator = (query: any, isNegated: boolean): any[] => {
		return this.filterOperator(query, !isNegated);
	}

	private isOperator = (query: any, isNegated: boolean): any[] => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		return this.getDataset(dataset).filter((data) => {
			const strToCheck: string = query[key];
			const updatedStr = strToCheck.replace(/\*/g, "");
			if (strToCheck.startsWith("*") && strToCheck.endsWith("*")) {
				return isNegated ?
					!(data[key].includes(updatedStr)) :
					data[key].includes(updatedStr);
			} else if (strToCheck.startsWith("*")) {
				return isNegated ?
					!(data[key].endsWith(updatedStr)) :
					data[key].endsWith(updatedStr);
			} else if (strToCheck.endsWith("*")) {
				return isNegated ?
					!(data[key].startsWith(updatedStr)) :
					data[key].startsWith(updatedStr);
			} else {
				return isNegated ?
					!(updatedStr === data[key]) :
					updatedStr === data[key];
			}
		});
	}


	private filterOperator = (query: any, isNegated: boolean): any[] => {
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
				return this.getDataset(this.dataset);
		}
	}

	private applyTransformations = (result: any[], transformations: any): any => {
		const relevantGroupFields = transformations.GROUP;
		const applyFields = transformations.APPLY;
		const relevantApplyFields = applyFields.map((x: any) => {
			return x[Object.keys(x)[0]][Object.keys(x[Object.keys(x)[0]])[0]];
		});
		const filterResultHashMap: Record<string, any> = {};
		result.forEach((x: any) => {
			const obj: any = {};
			let hash = "";
			relevantGroupFields.forEach((y: string) => {
				obj[y] = x[y];
				hash += `${y}:${x[y]};`;
			});
			if (!filterResultHashMap[hash]) {
				for (const field of relevantApplyFields) {
					if (!relevantGroupFields.includes(field)) {
						obj[field] = [x[field]];
					} else {
						obj[`${field}_temp`] = [x[field]];
					}
				}
				filterResultHashMap[hash] = obj;
			} else {
				for (const field of relevantApplyFields) {
					if (Array.isArray(filterResultHashMap[hash][field])) {
						filterResultHashMap[hash][field].push(x[field]);
					} else {
						filterResultHashMap[hash][`${field}_temp`].push(x[field]);
					}
				}
			}
		});
		if (Object.keys(filterResultHashMap).length > 5000) {
			throw new ResultTooLargeError();
		}
		return Object.keys(filterResultHashMap).map((key) => {
			const x = filterResultHashMap[key];
			for (const applyField of applyFields) {
				const field = Object.keys(applyField)[0];
				const applyFunction = Object.keys(applyField[field])[0];
				let applyFunctionArg = applyField[field][applyFunction];
				if (relevantGroupFields.includes(applyFunctionArg)) {
					applyFunctionArg = `${applyFunctionArg}_temp`;
				}
				x[field] = ApplyTransformationHelper.useTransformation(applyFunction, x[applyFunctionArg]);
			}
			return x;
		});
	}

	public queryAggregator = (query: any): any[] => {
		const where = query.WHERE;
		const options = query.OPTIONS;
		const transformations = query.TRANSFORMATIONS;
		let result = this.filterOperator(where, false);
		if (transformations) {
			result = this.applyTransformations(result, transformations);
		}
		if (result.length > 5000) {
			throw new ResultTooLargeError();
		}
		result = result.map((courses) => {
			const updatedResult: any = {};
			for (const key of options.COLUMNS) {
				updatedResult[key] = courses[key];
			}
			return updatedResult;
		});
		if (options.ORDER) {
			if (typeof options.ORDER === "string") {
				return result.sort(this.orderSort(options.ORDER));
			} else {
				let res = result;
				for (const key of options.ORDER.keys.reverse()) {
					res = res.sort(this.orderSort(key));
				}
				return options.ORDER.dir === "DOWN" ? res.reverse() : res;
			}
		} else {
			return result;
		}
	}

	private orderSort = (order: string) => {
		return (courseA: Record<string, string | number>, courseB: Record<string, string | number>) => {
			if (courseA[order] > courseB[order]) {
				return 1;
			} else if (courseA[order] < courseB[order]) {
				return -1;
			} else {
				return 0;
			}
		};
	}
}
