const makeQuery = (roomName: string) => {
	return {
		WHERE: {
			IS: {
				rooms_name: roomName,
			},
		},
		TRANSFORMATIONS: {
			"GROUP": [
				"rooms_name"
			],
			"APPLY": [
				{
					"seats": {
						"SUM": "rooms_seats"
					}
				}
			]
		},
		OPTIONS: {
			COLUMNS: [
				"rooms_name",
				"seats"
			],
			"ORDER": {
				"dir": "DOWN",
				"keys": [
					"seats"
				]
			}
		},
	}
}

export default makeQuery
