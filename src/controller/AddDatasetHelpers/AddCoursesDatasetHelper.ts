import { AddDatasetHelper } from "./AddDatasetHelper";
import JSZip from "jszip";

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

export default class AddCoursesDatasetHelper extends AddDatasetHelper {

	private static mapCourseDataset(id: string, result: any): any {
		const obj: any = {};
		for (const mapperKey of Object.keys(courseMapper)) {
			if (mapperKey === "uuid") {
				obj[`${id}_uuid`] = String(result[courseMapper["uuid"]]);
			} else if (mapperKey === "year") {
				if (result["Section"] === "overall") {
					obj[`${id}_year`] = 1900;
				} else {
					obj[`${id}_year`] = Number(result[courseMapper["year"]]);
				}
			} else {
				obj[`${id}_${mapperKey}`] = result[courseMapper[mapperKey]];
			}
		}
		return obj;
	}

	public makeResult = async (id: string, zipData: JSZip, results: any[]): Promise<void> => {
		const data = zipData.files;
		const keys = Object.keys(data).filter((key) => {
			// not a directory and the file is under courses
			return !data[key].dir && data[key].name.startsWith("courses");
		});

		for (const key of keys) {
			const JSONString = await this.streamToString(zipData.files[key].nodeStream());
			try {
				const JSONData = JSON.parse(JSONString);
				for (const result of JSONData.result) {
					results.push(AddCoursesDatasetHelper.mapCourseDataset(id, result));
				}
			} catch (e) {
				// do nothing
			}
		}
	}
}
