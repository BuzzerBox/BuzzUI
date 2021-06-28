import {open, openPromisified, PromisifiedBus} from "i2c-bus";

export class I2cService {
	private static instance: I2cService;
	private readonly BUS_NUMBER: number = 1;

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

	public test2(): void {
		this.read(0x19, 0x01).then(console.log);
	}

	private open(action: ((b: PromisifiedBus) => Promise<void>)): void {
		openPromisified(this.BUS_NUMBER)
			.then(i2c1 => action(i2c1)
				.then(() => i2c1.close()))
			.catch(console.log);
	}

	public read(address: number, command: number): Promise<number> {
		return new Promise<number>(resolve => {
			this.open(async (b: PromisifiedBus) => {
				resolve(b.readWord(address, command));
			})
		});
	}
}
