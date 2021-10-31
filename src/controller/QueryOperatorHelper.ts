import {ResultTooLargeError} from "./IInsightFacade";
import {DatasetData} from "./InsightFacade";
import ApplyTransformationHelper from "./ApplyTransformationHelper";

export default class QueryOperatorHelper {

	private datasets: DatasetData[];
	private dataset: string

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

	private eqOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[key] !== query[key] : data[key] === query[key];
		});
	}

	private gtOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[key] <= query[key] : data[key] > query[key];
		});
	}

	private ltOperator = async (query: any, isNegated: boolean): Promise<any[]> => {
		const key = Object.keys(query)[0];
		const dataset = key.split("_")[0];
		return this.getDataset(dataset).filter((data) => {
			return isNegated ? data[key] >= query[key] : data[key] < query[key];
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
				return this.getDataset(this.dataset);
		}
	}

	private deepEqualObject = (obj1: any, obj2: any, relevantFields: string[]) => {
		return relevantFields.every((field) => {
			return obj1[field] === obj2[field];
		});
	}

	private applyTransformations = (result: any[], transformations: any): any => {
		const relevantGroupFields = transformations.GROUP;
		const applyFields = transformations.APPLY;
		const relevantApplyFields = applyFields.map((x: any) => {
			return x[Object.keys(x)[0]][Object.keys(x[Object.keys(x)[0]])[0]];
		});
		const filterResultWithRelevantFieldsOnly: any[] = [];
		result.forEach((x: any) => {
			const obj: any = {};
			relevantGroupFields.forEach((y: string) => {
				obj[y] = x[y];
			});
			const findResult = filterResultWithRelevantFieldsOnly.findIndex((y: any) => {
				return this.deepEqualObject(obj, y, relevantGroupFields);
			});
			if (findResult === -1) {
				for (const field of relevantApplyFields) {
					if (!relevantGroupFields.includes(field)) {
						obj[field] = [x[field]];
					} else {
						obj[`${field}_temp`] = [x[field]];
					}
				}
				filterResultWithRelevantFieldsOnly.push(obj);
			} else {
				for (const field of relevantApplyFields) {
					if (Array.isArray(filterResultWithRelevantFieldsOnly[findResult][field])) {
						filterResultWithRelevantFieldsOnly[findResult][field].push(x[field]);
					} else {
						filterResultWithRelevantFieldsOnly[findResult][`${field}_temp`].push(x[field]);
					}
				}
			}
		});
		return filterResultWithRelevantFieldsOnly.map((x) => {
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

	public queryAggregator = async (query: any): Promise<any[]> => {
		const where = query.WHERE;
		const options = query.OPTIONS;
		const transformations = query.TRANSFORMATIONS;
		let result = await this.filterOperator(where, false);
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
					res = res.sort(this.orderSort(key, options.ORDER.dir));
				}
				return res;
			}
		} else {
			return result;
		}
	}

	private orderSort = (order: string, pos: string = "UP") => {
		return (courseA: Record<string, string | number>, courseB: Record<string, string | number>) => {
			if (courseA[order] > courseB[order]) {
				return pos === "DOWN" ? -1 : 1;
			} else if (courseA[order] < courseB[order]) {
				return pos === "DOWN" ? 1 : -1;
			} else {
				return 0;
			}
		};
	}
}
