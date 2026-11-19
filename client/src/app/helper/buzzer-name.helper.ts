import {BuzzerHelper, IBuzzer} from '../../../../shared/shared';
import {t} from '../i18n/i18n';

/**
 * What the master calls a buzzer, in its language
 */
export class BuzzerNameHelper {
  private constructor() {
    // making it private to avoid this class being instantiated
  }

  /**
   * A buzzer of the box has its name from the config. A wireless buzzer is named after the color of its case, e.g.
   * "Blauer Wireless Buzzer", so its name changes with it, or else after the end of its MAC address.
   * @param buzzers all buzzers: those that share a color also get the end of their MAC address, to tell them apart
   */
  public static getName(buzzer: IBuzzer, buzzers: IBuzzer[] = []): string {
    if (buzzer.type !== 'udp') {
      return buzzer.name ?? '';
    }
    const sharesColor = buzzer.color != null
      && buzzers.some(other => other.id !== buzzer.id && other.type === 'udp' && other.color === buzzer.color);
    return BuzzerNameHelper.getUdpName(buzzer.id, buzzer.color, sharesColor);
  }

  /**
   * @param buzzerIdOrMacAddress of a wireless buzzer
   * @param withMacEnd also for a buzzer with a color
   */
  public static getUdpName(buzzerIdOrMacAddress: string, color?: string, withMacEnd = false): string {
    const macEnd = BuzzerHelper.getMacEnd(buzzerIdOrMacAddress);
    const caseColor = BuzzerHelper.getCaseColor(color);
    if (caseColor == null) {
      return t('buzzer.wireless', {mac: macEnd});
    }
    const name = t(`caseColors.${caseColor.key}.buzzer`);
    return withMacEnd ? `${name} (${macEnd})` : name;
  }
}
