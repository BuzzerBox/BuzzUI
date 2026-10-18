import {SerialPortService} from '../../services/serial-port.service';
import {ConfigService} from '../../services/config.service';
import {Byte} from '../../../shared/objects/byte';

export class MicroControllerSerialAdapter {
  private constructor() {
    // hide public constructor
  }

  public static sendCommand(command: Byte | number, parameter?: Byte | number): void {
    const arrayOfBytes: Byte[] = [];

    if (command instanceof Byte) {
      arrayOfBytes.push(command);
    } else {
      arrayOfBytes.push(new Byte(command));
    }

    if (parameter != null) {
      if (parameter instanceof Byte) {
        arrayOfBytes.push(parameter);
      } else {
        arrayOfBytes.push(new Byte(parameter));
      }
    } else {
      arrayOfBytes.push(new Byte(ConfigService.get().serial.stuffingBit));
    }
    arrayOfBytes.push(new Byte(ConfigService.get().serial.eol));
    SerialPortService.get().writeBytes(arrayOfBytes);
  }

  public static sendSerialCommandReleaseLock(): void {
    this.sendCommand(ConfigService.get().serial.commands.softRelease);
  }

  public static sendSerialCommandSetBuzzer(buzzerNumber: number): void {
    this.sendCommand(ConfigService.get().serial.commands.setBuzzer, buzzerNumber);
  }

  /**
   * The buzzer neither locks the box nor lights up until all are enabled again, also across releases. Firmware from
   * before the command ignores it.
   * @param buzzerNumber its ID in the firmware, 0-9
   */
  public static sendSerialCommandDisableBuzzer(buzzerNumber: number): void {
    this.sendCommand(ConfigService.get().serial.commands.disableBuzzer, buzzerNumber);
  }

  public static sendSerialCommandEnableAllBuzzers(): void {
    this.sendCommand(ConfigService.get().serial.commands.enableAllBuzzers);
  }
}
