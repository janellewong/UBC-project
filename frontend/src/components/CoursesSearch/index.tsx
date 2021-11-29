import {Alert, Button, CardContent, Container, Grid, TextField, Typography} from "@mui/material";
import React, {useState} from "react";
import performQuery from "../../performQuery";
import CardComponent from "../CardComponent";
import makeQuery from "./makeQuery";

const CoursesSearch = () => {
	const [year, setYear] = useState<string>("");
	const [dept, setDept] = useState<string>("");
	const [id, setId] = useState<string>("");

	const [result, setResult] = useState<any[]>([]);
	const [error, setError] = useState<string>("");

	return (
		<Container>
			<CardComponent>
				<React.Fragment>
					<CardContent>
						<Grid container spacing={2}>
							<Grid item sm={3} xs={12}>
								<Typography sx={{fontSize: 14}} color="text.secondary" gutterBottom>
									Searching Courses
								</Typography>
								<form
									onSubmit={async (e): Promise<void> => {
										e.preventDefault();
										const query = makeQuery(year, dept, id)
										try {
											const queryResult = await performQuery(query);
											if (queryResult.result) setResult(queryResult.result);
											else setError(queryResult.error)
										} catch (e) {
											setError(String(e));
										}
									}}
								>
									<TextField
										label={"Year"}
										fullWidth
										value={year}
										required
										onChange={(e): void => {
											setYear(e.target.value);
										}}
									/>
									<br />
									<br />
									<TextField
										label={"Course Department (CPSC)"}
										fullWidth
										value={dept}
										required
										onChange={(e): void => {
											setDept(e.target.value);
										}}
									/>
									<br />
									<br />
									<TextField
										label={"Course ID (310)"}
										fullWidth
										value={id}
										required
										onChange={(e): void => {
											setId(e.target.value);
										}}
									/>
									<br />
									<br />
									<Button
										type={"submit"}
										color={"primary"}
										variant={"contained"}
										fullWidth
									>
										{"Search"}
									</Button>
								</form>
							</Grid>
							<Grid item sm={9} xs={12}>
								<Typography sx={{fontSize: 14}} color="text.secondary" gutterBottom>
									Result:
								</Typography>
								{result.length > 0 ?
									result.map(x => {
										return (
											<CardComponent>
												<Container>
													<h1>{x.failed} people failed {x.courses_dept.toUpperCase()} {x.courses_id} in {x.courses_year}.</h1>
												</Container>
											</CardComponent>
										)
									})
								: (
									<Alert severity="error">{error ? error : "No Results Found."}</Alert>
								)}
							</Grid>
						</Grid>
					</CardContent>
				</React.Fragment>
			</CardComponent>
		</Container>
	);
};

export default CoursesSearch;
