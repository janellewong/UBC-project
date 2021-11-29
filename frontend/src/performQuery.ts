const performQuery = (query: any): Promise<any> => {
	return fetch("/query", {
			"method": "POST",
			"headers": {
					"Content-Type": "application/json; charset=utf-8"
			},
			"body": JSON.stringify(query)
		})
		.then((res) => res.json())
		.catch(console.error.bind(console));
}

export default performQuery
