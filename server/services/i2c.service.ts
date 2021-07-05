import {BytesRead, openPromisified, PromisifiedBus} from "i2c-bus";
import {ByteHelper} from "../../shared/helper/byte.helper";

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

	public test2(): void {
		this.read(1,0x19).then(console.log).catch(console.log);
	}

	public async read(busNumber: number, address: number): Promise<number> {
		ByteHelper.assureBytes(busNumber, address);
		const resultBuffer: Buffer = Buffer.alloc(1);
		const promisifiedBus: PromisifiedBus = await openPromisified(busNumber);
		const readBytes: BytesRead = await promisifiedBus.i2cRead(address, resultBuffer.length, resultBuffer);
		console.log("plain", parseInt(readBytes.buffer.toString('hex'), 16));
		return parseInt(readBytes.buffer.toString('hex'), 16);
	}

	public async write(busNumber: number, address: number, command: number, byte: number): Promise<void> {
		ByteHelper.assureBytes(busNumber, address, command, byte);
		const promisifiedBus: PromisifiedBus = await openPromisified(busNumber);
		await promisifiedBus.writeByte(address, command, byte);
	}
}
