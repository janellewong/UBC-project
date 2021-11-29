import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, NotFoundError} from "./IInsightFacade";
import JSZip from "jszip";
import fs from "fs-extra";

import QueryValidatorHelper from "./QueryValidatorHelper";
import QueryOperatorHelper from "./QueryOperatorHelper";
import {AddDatasetHelper} from "./AddDatasetHelpers/AddDatasetHelper";
import AddCoursesDatasetHelper from "./AddDatasetHelpers/AddCoursesDatasetHelper";
import AddRoomsDatasetHelper from "./AddDatasetHelpers/AddRoomsDatasetHelper";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
const persistDir = "./data";

export type DatasetData = InsightDataset & { results: any[] }

export default class InsightFacade implements IInsightFacade {
	constructor() {
		console.trace("InsightFacadeImpl::init()");
		if (fs.existsSync(persistDir)) {
			fs.removeSync(persistDir);
		}
		this.datasets = [];
	}

	private isValidID = (idName: string): boolean => {
		return /^[^_]+$/.test(idName.trim());
	}

	private getDatasetsData = (): any[] => {
		try {
			if (fs.existsSync(`${persistDir}/data.json`)) {
				const buffer = fs.readFileSync(`${persistDir}/data.json`);
				return JSON.parse(buffer.toString());
			} else {
				fs.mkdirSync(persistDir);
			}
		} catch (e) {
			// do nothing
		}
		return [];
	}

	private readonly datasets: DatasetData[];

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		// is ID valid?
		if (!this.isValidID(id)) {
			throw new InsightError("id is not valid");
		}

		const datasets = this.getDatasetsData();

		// if dataset already exists in instance class
		if (datasets.some((current: any) => current.id === id)) {
			throw new InsightError("id already exists");
		}

		// load zip file
		let zipData: JSZip;
		try {
			zipData = await JSZip.loadAsync(content, { base64: true });
		} catch (e) {
			throw new InsightError("Unable to import ZIP file");
		}

		const addDatasetHelper: AddDatasetHelper | undefined = kind === InsightDatasetKind.Rooms ?
			new AddRoomsDatasetHelper() :
			kind === InsightDatasetKind.Courses ? new AddCoursesDatasetHelper() : undefined;

		if (!addDatasetHelper) {
			throw new InsightError("Not a valid dataset type");
		}

		let results: any[] = [];
		await addDatasetHelper.makeResult(id, zipData, results);

		if (results.length === 0) {
			throw new InsightError("no data");
		}

		// iterate through each file and push result to array
		this.datasets.push({
			id,
			kind,
			numRows: results.length,
			results
		});

		fs.writeFileSync(`${persistDir}/data.json`, JSON.stringify(this.datasets));

		return this.datasets.map((dataset: any) => dataset.id);
	}

	public async removeDataset(id: string): Promise<string> {
		// Helper function to determine if ID (string input) is valid
		if (!this.isValidID(id)) {
			throw new InsightError("id is not valid");
		}
		// find in this.datasets and if it exists, remove the index from datasets using Array.splice
		// if it does not exist in this.datasets, throw NotFoundError
		// Remove dataset from data folder

		const index = this.datasets.findIndex((dataset) => dataset.id === id);
		// const datasets = this.getDatasetsData();
		//
		// const index = datasets.findIndex((dataset: any) => dataset.id === id);
		if (index === -1) {
			throw new NotFoundError();
		}
		this.datasets.splice(index, 1);
		// datasets.splice(index, 1);
		fs.writeFileSync(`${persistDir}/data.json`, JSON.stringify(this.datasets));
		return id;
	}

	public async performQuery(query: any): Promise<any[]> {
		// const datasets = this.getDatasetsData();
		// const queryValidatorHelper = new QueryValidatorHelper(datasets);
		const queryValidatorHelper = new QueryValidatorHelper(this.datasets);
		const usedDataset = queryValidatorHelper.queryValidator(query);
		if (!usedDataset) {
			throw new InsightError("Invalid Query");
		}
		const queryOperatorHelper = new QueryOperatorHelper(this.datasets, usedDataset);
		return queryOperatorHelper.queryAggregator(query);
	}

	public listDatasets(): Promise<InsightDataset[]> {
		// const datasets = this.getDatasetsData();
		// return Promise.resolve(datasets.map(({ results, ...dataset }: any) => dataset));
		return Promise.resolve(this.datasets.map(({ results, ...dataset }: any) => dataset));
	}
}
