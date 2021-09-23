import {
	InsightDatasetKind,
	InsightError,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";

import * as fs from "fs-extra";

import {testFolder} from "@ubccpsc310/folder-test";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const expect = chai.expect;

describe("InsightFacade", function () {
	let insightFacade: InsightFacade;

	const persistDir = "./data";
	const datasetContents = new Map<string, string>();

	// Reference any datasets you've added to test/resources/archives here and they will
	// automatically be loaded in the 'before' hook.
	const datasetsToLoad: {[key: string]: string} = {
		courses: "./test/resources/archives/courses.zip",
		a: "./test/resources/archives/a.zip",
		b: "./test/resources/archives/b.zip",
		noSections: "./test/resources/archives/noSections.zip",
		noFiles: "./test/resources/archives/noFiles.zip",
		noCourses: "./test/resources/archives/noCourses.zip",
		invalidJSON: "./test/resources/archives/invalidJSON.zip",
	};

	before(function () {
		// This section runs once and loads all datasets specified in the datasetsToLoad object
		for (const key of Object.keys(datasetsToLoad)) {
			const content = fs.readFileSync(datasetsToLoad[key]).toString("base64");
			datasetContents.set(key, content);
		}
		// Just in case there is anything hanging around from a previous run
		fs.removeSync(persistDir);
	});

	describe("Add/Remove/List Dataset", function () {
		before(function () {
			console.info(`Before: ${this.test?.parent?.title}`);
		});

		beforeEach(function () {
			// This section resets the insightFacade instance
			// This runs before each test
			console.info(`BeforeTest: ${this.currentTest?.title}`);
			insightFacade = new InsightFacade();
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
		});

		afterEach(function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent from the previous one
			console.info(`AfterTest: ${this.currentTest?.title}`);
			fs.removeSync(persistDir);
		});

		// This is a unit test. You should create more like this!
		it("Should add a valid dataset", function () {
			const id: string = "courses";
			const content: string = datasetContents.get("courses") ?? "";
			const expected: string[] = [id];
			return insightFacade.addDataset(id, content, InsightDatasetKind.Courses).then((result: string[]) => {
				expect(result).to.deep.equal(expected);
			});
		});

		it("Unable to add dataset (is underscore)", () => {
			const id: string = "_";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (contains underscore)", () => {
			const id: string = "hello_world";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (is whitespace -- spaces)", () => {
			const id: string = "     ";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (is whitespace -- tabs)", () => {
			const id: string = "\t\t\t\t";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (is whitespace -- mixed)", () => {
			const id: string = "\t\t  \t\t";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (is empty)", () => {
			const id: string = "";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (is duplicate)", () => {
			const id: string = "a";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				insightFacade
					.addDataset(id, contentA, InsightDatasetKind.Courses)
					.then(() => insightFacade.addDataset(id, contentB, InsightDatasetKind.Courses))
			).to.eventually.rejectedWith(InsightError);
		});

		it("Unable to add dataset (is invalid base64)", () => {
			const id: string = "a";
			const content: string = "lorem ipsum dolor sit amet";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (is invalid zip)", () => {
			const id: string = "a";
			const content: string = "aGVsbG8gd29ybGQ=";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (no courses)", () => {
			const id: string = "courses";
			const content: string = datasetContents.get("noCourses") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.rejectedWith(
				InsightError
			);
		});

		it("Unable to add dataset (no files)", () => {
			const id: string = "courses";
			const content: string = datasetContents.get("noFiles") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.listDatasets())
			).to.eventually.rejectedWith(InsightError);
		});

		it("Unable to add dataset (no sections)", () => {
			const id: string = "courses";
			const content: string = datasetContents.get("noSections") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.listDatasets())
			).to.eventually.rejectedWith(InsightError);
		});

		it("Is able to add a single dataset successfully (with invalid JSON)", () => {
			const id: string = "invalidJSON";
			const content: string = datasetContents.get("invalidJSON") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.deep.equal([
				id,
			]);
		});

		it("Is able to add a single dataset successfully (with whitespaces)", () => {
			const id: string = "cs 310";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.deep.equal([
				id,
			]);
		});

		it("Is able to add a single dataset successfully (with whitespaces at start)", () => {
			const id: string = " cs310";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.deep.equal([
				id,
			]);
		});

		it("Is able to add a single dataset successfully (with whitespaces at end)", () => {
			const id: string = "cs310 ";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.deep.equal([
				id,
			]);
		});

		it("Is able to add a single dataset successfully (with whitespaces at edges)", () => {
			const id: string = " cs310 ";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.deep.equal([
				id,
			]);
		});

		it("Is able to add a single dataset successfully (with whitespaces mixed)", () => {
			const id: string = " cs 310 ";
			const content: string = datasetContents.get("a") ?? "";
			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Courses)).to.eventually.deep.equal([
				id,
			]);
		});

		it("Adds multiple datasets properly", () => {
			const idA: string = "a";
			const idB: string = "b";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return insightFacade
				.addDataset(idA, contentA, InsightDatasetKind.Courses)
				.then(() => insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses))
				.then((result) => {
					expect(result).to.deep.equal([idA, idB]);
				});
		});

		it("Removes dataset properly", () => {
			const id: string = "a";
			const content: string = datasetContents.get("a") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.removeDataset(id))
			).to.eventually.equal(id);
		});

		it("Removes dataset properly (with whitespaces)", () => {
			const id: string = "cs 310";
			const content: string = datasetContents.get("a") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.removeDataset(id))
			).to.eventually.equal(id);
		});

		it("Removes dataset properly (with whitespaces at start)", () => {
			const id: string = " cs310";
			const content: string = datasetContents.get("a") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.removeDataset(id))
			).to.eventually.equal(id);
		});

		it("Removes dataset properly (with whitespaces at end)", () => {
			const id: string = "cs310 ";
			const content: string = datasetContents.get("a") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.removeDataset(id))
			).to.eventually.equal(id);
		});

		it("Removes dataset properly (with whitespaces at edges)", () => {
			const id: string = " cs310 ";
			const content: string = datasetContents.get("a") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.removeDataset(id))
			).to.eventually.equal(id);
		});

		it("Removes dataset properly (with whitespaces mixed)", () => {
			const id: string = " cs 310 ";
			const content: string = datasetContents.get("a") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.removeDataset(id))
			).to.eventually.equal(id);
		});

		it("Unable to remove dataset properly (not found)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const idNotValid: string = "c";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				insightFacade
					.addDataset(idA, contentA, InsightDatasetKind.Courses)
					.then(() => insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses))
					.then(() => insightFacade.removeDataset(idNotValid))
			).to.eventually.rejectedWith(NotFoundError);
		});

		it("Unable to remove dataset properly (is underscore)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const idNotValid: string = "_";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				Promise.all([
					insightFacade.addDataset(idA, contentA, InsightDatasetKind.Courses),
					insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses),
				]).then(() => insightFacade.removeDataset(idNotValid))
			).to.eventually.rejectedWith(InsightError);
		});

		it("Unable to remove dataset properly (contains underscore)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const idNotValid: string = "hello_world";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				Promise.all([
					insightFacade.addDataset(idA, contentA, InsightDatasetKind.Courses),
					insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses),
				]).then(() => insightFacade.removeDataset("hello_world"))
			).to.eventually.rejectedWith(InsightError);
		});

		it("Unable to remove dataset properly (is whitespace - spaces)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const idNotValid: string = "       ";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				Promise.all([
					insightFacade.addDataset(idA, contentA, InsightDatasetKind.Courses),
					insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses),
				]).then(() => insightFacade.removeDataset(idNotValid))
			).to.eventually.rejectedWith(InsightError);
		});

		it("Unable to remove dataset properly (is whitespace - tabs)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const idNotValid: string = "\t\t\t\t";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				Promise.all([
					insightFacade.addDataset(idA, contentA, InsightDatasetKind.Courses),
					insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses),
				]).then(() => insightFacade.removeDataset(idNotValid))
			).to.eventually.rejectedWith(InsightError);
		});

		it("Unable to remove dataset properly (is whitespace - mixed)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const idNotValid: string = "\t\t    \t\t";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				Promise.all([
					insightFacade.addDataset(idA, contentA, InsightDatasetKind.Courses),
					insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses),
				]).then(() => insightFacade.removeDataset(idNotValid))
			).to.eventually.rejectedWith(InsightError);
		});

		it("Unable to remove dataset properly (removed already)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				insightFacade
					.addDataset(idA, contentA, InsightDatasetKind.Courses)
					.then(() => insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses))
					.then(() => insightFacade.removeDataset(idA))
					.then(() => insightFacade.removeDataset(idA))
			).to.eventually.rejectedWith(NotFoundError);
		});

		it("Lists all datasets properly (if empty)", () => {
			return insightFacade.listDatasets().then((insightDatasets) => {
				expect(insightDatasets).to.be.an.instanceOf(Array);
				expect(insightDatasets).to.have.length(0);
			});
		});

		it("Lists all datasets properly (if one)", () => {
			const id: string = "a";
			const content: string = datasetContents.get("a") ?? "";
			return expect(
				insightFacade
					.addDataset(id, content, InsightDatasetKind.Courses)
					.then(() => insightFacade.listDatasets())
			).to.eventually.have.length(1);
		});

		it("Lists all datasets properly (if two)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				insightFacade
					.addDataset(idA, contentA, InsightDatasetKind.Courses)
					.then(() => insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses))
					.then(() => insightFacade.listDatasets())
			).to.eventually.have.length(2);
		});

		it("Lists all datasets properly (if two with data)", () => {
			const idA: string = "a";
			const idB: string = "b";
			const contentA: string = datasetContents.get("a") ?? "";
			const contentB: string = datasetContents.get("b") ?? "";
			return expect(
				insightFacade
					.addDataset(idA, contentA, InsightDatasetKind.Courses)
					.then(() => insightFacade.addDataset(idB, contentB, InsightDatasetKind.Courses))
					.then(() => insightFacade.listDatasets())
			).to.eventually.deep.equal([
				{
					id: "a",
					kind: InsightDatasetKind.Courses,
					numRows: 143,
				},
				{
					id: "b",
					kind: InsightDatasetKind.Courses,
					numRows: 224,
				},
			]);
		});
	});

	/*
	 * This test suite dynamically generates tests from the JSON files in test/queries.
	 * You should not need to modify it; instead, add additional files to the queries directory.
	 * You can still make tests the normal way, this is just a convenient tool for a majority of queries.
	 */
	describe("PerformQuery", () => {
		before(function () {
			console.info(`Before: ${this.test?.parent?.title}`);

			insightFacade = new InsightFacade();

			// Load the datasets specified in datasetsToQuery and add them to InsightFacade.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises = [
				insightFacade.addDataset("courses", datasetContents.get("courses") ?? "", InsightDatasetKind.Courses),
			];

			return Promise.all(loadDatasetPromises);
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
			fs.removeSync(persistDir);
		});

		type PQErrorKind = "ResultTooLargeError" | "InsightError";

		testFolder<any, any[], PQErrorKind>(
			"Dynamic InsightFacade PerformQuery tests",
			(input) => insightFacade.performQuery(input),
			"./test/resources/queries",
			{
				assertOnResult: (expected: any, actual: any[]): void => {
					expect(actual).to.have.deep.members(expected);
				},
				errorValidator: (error): error is PQErrorKind =>
					error === "ResultTooLargeError" || error === "InsightError",
				assertOnError(expected, actual) {
					if (expected === "ResultTooLargeError") {
						expect(actual).to.be.instanceof(ResultTooLargeError);
					} else {
						expect(actual).to.be.instanceof(InsightError);
					}
				},
			}
		);
	});
});
