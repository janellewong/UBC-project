import JSZip from "jszip";

export abstract class AddDatasetHelper {
	public abstract makeResult(id: string, zipData: JSZip, results: any[]): Promise<void>;

	// Code from: https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable
	protected streamToString = (stream: NodeJS.ReadableStream): Promise<string> => {
		const chunks: Buffer[] = [];
		return new Promise((resolve) => {
			stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
			stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		});
	}
}
