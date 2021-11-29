import express, {Application, Request, Response} from "express";
import * as http from "http";
import cors from "cors";
import {parse} from "url";
import InsightFacade from "../controller/InsightFacade";
import {InsightDatasetKind, NotFoundError} from "../controller/IInsightFacade";
let nextJSApp: any, handle: any;
try {
	const next = require("next");
	nextJSApp = next({ dir: "./frontend", dev: process.env.NODE_ENV !== "production" });
	handle = nextJSApp.getRequestHandler();
} catch (e) {
	// do nothing
}

export default class Server {
	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;
	private insightFacade: InsightFacade;

	constructor(port: number) {
		console.info(`Server::<init>( ${port} )`);
		this.port = port;
		this.express = express();
		this.insightFacade = new InsightFacade();

		this.registerMiddleware();
		this.registerRoutes();

		// NOTE: you can serve static frontend files in from your express server
		// by uncommenting the line below. This makes files in ./frontend/public
		// accessible at http://localhost:<port>/
		// this.express.use(express.static("./frontend/public"))
	}

	private listenServer = (): Promise<void> => {
		return new Promise((resolve, reject) => {
			this.server = this.express.listen(this.port, () => {
				console.info(`Server::start() - server listening on port: ${this.port}`);
				resolve();
			}).on("error", (err: Error) => {
				// catches errors in server start
				console.error(`Server::start() - server ERROR: ${err.message}`);
				reject(err);
			});
		});
	}

	/**
	 * Starts the server. Returns a promise that resolves if success. Promises are used
	 * here because starting the server takes some time and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<void>}
	 */
	public start(): Promise<void> {
		return new Promise((resolve, reject) => {
			console.info("Server::start() - start");
			if (this.server !== undefined) {
				console.error("Server::start() - server already listening");
				reject();
			} else {
				if (nextJSApp) {
					nextJSApp.prepare().then(this.listenServer).then(resolve).catch(reject);
				} else {
					return this.listenServer().then(resolve).catch(reject);
				}
			}
		});
	}

	/**
	 * Stops the server. Again returns a promise so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<void>}
	 */
	public stop(): Promise<void> {
		console.info("Server::stop()");
		return new Promise((resolve, reject) => {
			if (this.server === undefined) {
				console.error("Server::stop() - ERROR: server not started");
				reject();
			} else {
				this.server.close(() => {
					console.info("Server::stop() - server closed");
					resolve();
				});
			}
		});
	}

	// Registers middleware to parse request before passing them to request handlers
	private registerMiddleware() {

		if (nextJSApp) {
			this.express.use((req, res) => {
				const parsedUrl = parse(req.url, true);
				handle(req, res, parsedUrl);
			});
		}

		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({type: "application/*", limit: "10mb"}));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
	}

	// Registers all request handlers to routes
	private registerRoutes() {
		// This is an example endpoint this you can invoke by accessing this URL in your browser:
		// http://localhost:4321/echo/hello
		this.express.get("/echo/:msg", Server.echo);

		this.express.put("/dataset/:id/:kind", this.addDataset);
		this.express.delete("/dataset/:id", this.deleteDataset);
		this.express.post("/query", this.queryDataset);
		this.express.get("/datasets", this.getDatasets);
	}

	private static formResult = (result: any) => {
		return {
			result
		};
	}

	private static formError = (error: Error) => {
		return {
			error: error.toString()
		};
	}

	private addDataset = (req: Request, res: Response) => {
		let id = req.params.id;
		let content = req.body;
		let kind = req.params.kind === "courses" ?
			InsightDatasetKind.Courses :
			req.params.kind === "rooms" ?
				InsightDatasetKind.Rooms :
				undefined;
		if (!kind) {
			res.status(400).json(Server.formError(new Error("Not a valid InsightDatasetKind")));
			return;
		}
		return this.insightFacade.addDataset(id, content, kind).then((result) => {
			res.status(200).json(Server.formResult(result));
		}).catch((error) => {
			res.status(400).json(Server.formError(error));
		});
	}

	private deleteDataset = (req: Request, res: Response) => {
		let id = req.params.id;
		return this.insightFacade.removeDataset(id).then((result) => {
			res.status(200).json(Server.formResult(result));
		}).catch((error) => {
			res.status(error instanceof NotFoundError ? 404 : 400).json(Server.formError(error));
		});
	}

	private queryDataset = (req: Request, res: Response) => {
		let query = req.body;
		return this.insightFacade.performQuery(query).then((result) => {
			res.status(200).json(Server.formResult(result));
		}).catch((error) => {
			res.status(400).json(Server.formError(error));
		});
	}

	private getDatasets = (_req: Request, res: Response) => {
		return this.insightFacade.listDatasets().then((result: any) => {
			res.status(200).json(Server.formResult(result));
		}).catch((err: any) => {
			res.status(400).json(Server.formError(err));
		});
	}

	// The next two methods handle the echo service.
	// These are almost certainly not the best place to put these, but are here for your reference.
	// By updating the Server.echo function pointer above, these methods can be easily moved.
	private static echo(req: Request, res: Response) {
		try {
			console.log(`Server::echo(..) - params: ${JSON.stringify(req.params)}`);
			const response = Server.performEcho(req.params.msg);
			res.status(200).json({result: response});
		} catch (err) {
			res.status(400).json({error: err});
		}
	}

	private static performEcho(msg: string): string {
		if (typeof msg !== "undefined" && msg !== null) {
			return `${msg}...${msg}`;
		} else {
			return "Message not provided";
		}
	}
}
