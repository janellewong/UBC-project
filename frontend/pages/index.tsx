import {NextPage} from "next";
import React from "react";
import CoursesSearch from "../src/components/CoursesSearch";
import {Button, Container} from "@mui/material";
import initializeDataset from "../src/initializeDataset";
import RoomsSearch from "../src/components/RoomsSearch";

const Home: NextPage = () => {
	return (
		<>
			<br />
			<br />
			<CoursesSearch />
			<br />
			<br />
			<RoomsSearch />
			<br />
			<br />
			<Container>
				<Button
					color={"primary"}
					variant={"contained"}
					fullWidth
					onClick={() => {
						initializeDataset();
					}}
				>
					{"Initialize Dataset"}
				</Button>
			</Container>
		</>
	);
};

export default Home;
