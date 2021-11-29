const makeQuery = (year: string, dept: string, id: string) => {
	return {
		WHERE: {
			AND: [
				{
					EQ: {
						courses_year: Number(year),
					},
				},
				{
					IS: {
						courses_dept: dept.toLowerCase(),
					},
				},
				{
					IS: {
						courses_id: id,
					},
				},
			],
		},
		TRANSFORMATIONS: {
			GROUP: [
				"courses_dept",
				"courses_id",
				"courses_year"
			],
			"APPLY": [
				{
					"failed": {
						"SUM": "courses_fail"
					}
				}
			]
		},
		OPTIONS: {
			COLUMNS: [
				"courses_dept",
				"courses_id",
				"courses_year",
				"failed"
			],
			"ORDER": {
				"dir": "DOWN",
				"keys": [
					"failed"
				]
			}
		},
	}
}

export default makeQuery
