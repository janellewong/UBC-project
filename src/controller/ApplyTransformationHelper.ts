import Decimal from "decimal.js";

export default class ApplyTransformationHelper {

	public static useTransformation = (operation: string, array: number[]): number => {
		switch (operation) {
			case "MAX":
				return ApplyTransformationHelper.maxValue(array);
			case "MIN":
				return ApplyTransformationHelper.minValue(array);
			case "AVG":
				return ApplyTransformationHelper.averageValue(array);
			case "SUM":
				return ApplyTransformationHelper.sumValue(array);
			default:
				return ApplyTransformationHelper.countValue(array);
		}
	}

	private static maxValue = (array: number[]): number => {
		return Math.max(...array);
	}

	private static minValue = (array: number[]): number => {
		return Math.min(...array);
	}

	private static averageValue = (array: number[]): number => {
		return Number(
			(
				ApplyTransformationHelper.sumValueAsDecimal(array) / array.length
			).toFixed(2)
		);
	}

	private static sumValueAsDecimal = (array: number[]): number => {
		return array.reduce((a, b) => a.add(new Decimal(b)), new Decimal(0)).toNumber();
	}

	private static sumValue = (array: number[]): number => {
		return Number(array.reduce((a, b) => a + b, 0).toFixed(2));
	}

	private static countValue = (array: any[]): number => {
		return [...new Set(array)].length;
	}
}
