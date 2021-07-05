export class ByteHelper {
	private constructor() {
		// hide constructor
	}

	public static assureByte(b: number): void {
		if (b < 0 || 255 < b) {
			throw new Error(`The number "${b}" is not a valid byte!`);
		}
	}

	public static assureBytes(...b: number[]) {
		for (const b1 of b) {
			this.assureByte(b1);
		}
	}
}
