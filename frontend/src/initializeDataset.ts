const initializeDataset = (): Promise<any> => {
	return fetch("/datasets/initialize", {
			"method": "POST"
		})
		.then((res) => res.json())
		.catch(console.error.bind(console));
}

export default initializeDataset
