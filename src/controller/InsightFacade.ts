import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, NotFoundError} from "./IInsightFacade";
import JSZip from "jszip";


/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	constructor() {
		console.trace("InsightFacadeImpl::init()");
	}

	private datasets: InsightDataset[] = [];
	private dataInDatasets: Record<string, any[]> = {};

	private isValidID = (idName: string): boolean => {
		return /^[^_]+$/.test(idName.trim());
	}

	// Code from: https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable
	private streamToString = (stream: NodeJS.ReadableStream): Promise<string> => {
		const chunks: Buffer[] = [];
		return new Promise((resolve) => {
			stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
			stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		});
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		// is ID valid?
		if (this.isValidID(id) === false) {
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

		// filter zip files if file is under "courses"

		const data = zipData.files;
		// console.log(zipData.files);
		const keys = Object.keys(data).filter((key) => {
			// not a directory and the file is under courses
			return !data[key].dir && data[key].name.startsWith("courses");
		});

		for (const key of keys){
			const JSONString = await this.streamToString(zipData.files[key].nodeStream());
			try {
				const JSONData = JSON.parse(JSONString);
				for (const result of JSONData.result) {
					if (!this.dataInDatasets[id]) {
						this.dataInDatasets[id] = []; // initialize
					}
					this.dataInDatasets[id].push(result);
				}
			} catch (e) {
				// do nothing
			}
		}

		if (!this.dataInDatasets[id]) {
			throw new InsightError("no data");
		}

		// iterate through each file and push result to array
		this.datasets.push({
			id,
			kind,
			numRows: this.dataInDatasets[id].length
		});

		return this.datasets.map((dataset) => dataset.id);
	}

	public async removeDataset(id: string): Promise<string> {
		// Helper function to determine if ID (string input) is valid
		if (this.isValidID(id) === false) {
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
		return Promise.reject("Not implemented.");
	}

	public listDatasets(): Promise<InsightDataset[]> {
		return Promise.resolve(this.datasets);
	}
}
