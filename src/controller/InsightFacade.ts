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
		try {
			if (fs.existsSync(`${persistDir}/data.json`)) {
				const buffer = fs.readFileSync(`${persistDir}/data.json`);
				this.datasets = JSON.parse(buffer.toString());
				return;
			} else {
				fs.mkdirSync(persistDir);
			}
		} catch (e) {
			// do nothing
		}
		this.datasets = [];
	}

	private readonly datasets: DatasetData[];

	private isValidID = (idName: string): boolean => {
		return /^[^_]+$/.test(idName.trim());
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		// is ID valid?
		if (!this.isValidID(id)) {
			throw new InsightError("id is not valid");
		}
		// if dataset already exists in instance class
		if (this.datasets.some((current) => current.id === id)) {
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

		return this.datasets.map((dataset) => dataset.id);
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
		if (index === -1) {
			throw new NotFoundError();
		}
		this.datasets.splice(index, 1);
		return id;
	}

	public performQuery(query: any): Promise<any[]> {
		const queryValidatorHelper = new QueryValidatorHelper(this.datasets);
		const usedDataset = queryValidatorHelper.queryValidator(query);
		if (!usedDataset) {
			throw new InsightError("Invalid Query");
		}
		const queryOperatorHelper = new QueryOperatorHelper(this.datasets, usedDataset);
		return queryOperatorHelper.queryAggregator(query);
	}

	public listDatasets(): Promise<InsightDataset[]> {
		return Promise.resolve(this.datasets.map(({ results, ...dataset }) => dataset));
	}
}
