import {I2cService} from "../../services/i2c.service";
import config from '../../../config.json';
import {ByteHelper} from "../../../shared/helper/byte.helper";

export class MicroControllerI2CAdapter {
	private static readonly BITMASK_BUZZER_LOCK: number = 0b10000000; // 128
	private static readonly VALUE_IDLE_SITUATION: number = 127;
	private static readonly VALUE_BUZZER_0: number = 0;
	private static readonly VALUE_BUZZER_1: number = 1;
	private static readonly VALUE_BUZZER_2: number = 2;
	private static readonly VALUE_BUZZER_3: number = 3;
	private static readonly VALUE_BUZZER_4: number = 4;
	private static readonly VALUE_BUZZER_5: number = 5;
	private static readonly VALUE_BUZZER_6: number = 6;
	private static readonly VALUE_BUZZER_7: number = 7;
	private static readonly VALUE_BUZZER_8: number = 8;
	private static readonly VALUE_BUZZER_9: number = 9;

	private constructor() {
		// hide constructor
	}

	public static async isBuzzerLockActive(): Promise<boolean> {
		const result: number = await this.read();
		// filter out all other 1s (when seen in binary code) and then check if the first bit is a 1
		return (result & this.BITMASK_BUZZER_LOCK) === this.BITMASK_BUZZER_LOCK;
	}

	/**
	 * Will return the number of the pressed buttons from 0 - 9. If result is 127, then no button is pressed
	 */
	public static async getPressedBuzzer(): Promise<number> {
		const result: number = await this.read();
		// erase the bit for the buzzer lock to receive the naked number of the buzzer that is pressed
		// return result ^ this.BITMASK_BUZZER_LOCK;
		return result;
	}

	private static async read(): Promise<number> {
		return I2cService.get().read(this.getBusNumber(), this.getMicroControllerAddress());
	}

	private static toInt(s: string): number {
		return parseInt(s, 10);
	}

	private static getBusNumber(): number {
		return this.toInt(config.i2c.busNumber);
	}

	private static getMicroControllerAddress(): number {
		return this.toInt(config.i2c.addresses.microController);
	}

	private static async write(command: number, parameter?: number): Promise<void> {
		ByteHelper.assureByte(command);
		if (parameter != null) {
			ByteHelper.assureByte(parameter);
		}
		await I2cService.get().write(this.getBusNumber(), this.getMicroControllerAddress(), command, parameter != null ? parameter : 0);
	}

	public static async releaseBuzzerLock(): Promise<void> {
		await this.write(this.toInt(config.i2c.commands.softRelease));
	}

	public static async setBuzzerPressed(buzzer: number): Promise<void> {
		await this.write(this.toInt(config.i2c.commands.setBuzzer), buzzer);
	}

}
