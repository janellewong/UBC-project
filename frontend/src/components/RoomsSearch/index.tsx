import {Alert, Button, CardContent, Container, Grid, TextField, Typography} from "@mui/material";
import React, {useState} from "react";
import performQuery from "../../performQuery";
import CardComponent from "../CardComponent";
import makeQuery from "./makeQuery";

const RoomsSearch = () => {
	const [roomName, setRoomName] = useState<string>("");

	const [result, setResult] = useState<any[]>([]);
	const [error, setError] = useState<string>("");

	return (
		<Container>
			<CardComponent>
				<React.Fragment>
					<CardContent>
						<Grid container spacing={2}>
							<Grid item sm={5} xs={12}>
								<Typography sx={{fontSize: 14}} color="text.secondary" gutterBottom>
									Searching Rooms
								</Typography>
								<form
									onSubmit={async (e): Promise<void> => {
										e.preventDefault();
										const query = makeQuery(roomName)
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
										label={"Room name (ex. \"ANGU_098\" = Henry Angus, Room 098)"}
										fullWidth
										value={roomName}
										required
										onChange={(e): void => {
											setRoomName(e.target.value);
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
							<Grid item sm={7} xs={12}>
								<Typography sx={{fontSize: 14}} color="text.secondary" gutterBottom>
									Result:
								</Typography>
								{result.length > 0 ?
									result.map(x => {
										return (
											<CardComponent>
												<Container>
													<h1>{x.seats} seats are available in Room {x.rooms_name}.</h1>
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

export default RoomsSearch;
