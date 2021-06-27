import {open} from "i2c-bus";

// const i2c = require('i2c-bus');



export class I2cService {
	private static instance: I2cService;

	private constructor() {
		//
	}

	public static get(): I2cService {
		if (this.instance == null) {
			this.instance = new I2cService();
		}
		return this.instance;
	}

	public test(): void {
		const rbuf = Buffer.alloc(1);

		const i2c1 = open(1, err => {
			if (err) throw err;
			i2c1.i2cRead(0x19,rbuf.length, rbuf, res => {
				console.log(rbuf.toString('hex'));
			});
		});
	}
}
