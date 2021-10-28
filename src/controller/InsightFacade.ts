import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, NotFoundError} from "./IInsightFacade";
import JSZip from "jszip";
import fs from "fs-extra";

import QueryValidatorHelper from "./QueryValidatorHelper";
import QueryOperatorHelper from "./QueryOperatorHelper";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
const persistDir = "./data";

const courseMapper: any = {
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

	// Code from: https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable
	private streamToString = (stream: NodeJS.ReadableStream): Promise<string> => {
		const chunks: Buffer[] = [];
		return new Promise((resolve) => {
			stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
			stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		});
	}

	private static mapCourseDataset(result: any): any {
		const obj: any = {};
		for (const mapperKey of Object.keys(courseMapper)) {
			if (mapperKey === "uuid") {
				obj["uuid"] = String(result[courseMapper["uuid"]]);
			} else if (mapperKey === "year") {
				if (result["Section"] === "overall") {
					obj["year"] = 1900;
				} else {
					obj["year"] = Number(result[courseMapper["year"]]);
				}
			} else {
				obj[mapperKey] = result[courseMapper[mapperKey]];
			}
		}
		return obj;
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

		// filter zip files if file is under "courses"

		const data = zipData.files;
		// console.log(zipData.files);
		const keys = Object.keys(data).filter((key) => {
			// not a directory and the file is under courses
			return !data[key].dir && data[key].name.startsWith("courses");
		});

		const results = [];

		for (const key of keys){
			const JSONString = await this.streamToString(zipData.files[key].nodeStream());
			try {
				const JSONData = JSON.parse(JSONString);
				for (const result of JSONData.result) {
					results.push(InsightFacade.mapCourseDataset(result));
				}
			} catch (e) {
				// do nothing
			}
		}

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
		if (!queryValidatorHelper.queryValidator(query)) {
			throw new InsightError("Invalid Query");
		}
		const queryOperatorHelper = new QueryOperatorHelper(this.datasets);
		return queryOperatorHelper.queryAggregator(query);
	}

	public listDatasets(): Promise<InsightDataset[]> {
		return Promise.resolve(this.datasets.map(({ results, ...dataset }) => dataset));
	}
}
