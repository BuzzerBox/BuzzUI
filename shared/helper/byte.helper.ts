import {Byte} from '../objects/byte';
import {Buffer} from 'buffer';

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

	public static bytesToBuffer(bytes: Byte[]): Buffer {
		const b = Buffer.alloc(bytes.length, 0);
		for (let i = 0; i < bytes.length; i++) {
			b[i] = bytes[i].getValue();
		}
		return b;
	}
}
