import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {BuzzerHelper, ICaseColor, IUsbBuzzer, TUsbBuzzerError} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';

/**
 * A card for each wireless buzzer plugged into the box over USB. Adopting one gives it the box's WiFi, after which it
 * connects to the box by itself. The color of its case is chosen there too; the buzzer keeps it and its team has it on
 * the screens. A card goes away when its buzzer is unplugged.
 */
@Component({
    selector: 'app-usb-buzzer-cards',
    templateUrl: './usb-buzzer-cards.component.html',
    styleUrls: ['./usb-buzzer-cards.component.css'],
    standalone: false
})
export class UsbBuzzerCardsComponent implements OnInit, OnDestroy {
  public readonly caseColors: ICaseColor[] = BuzzerHelper.CASE_COLORS;
  public buzzers: IUsbBuzzer[] = [];
  // the color chosen on a card, by IUsbBuzzer.path, until its buzzer is unplugged
  private readonly chosenColors = new Map<string, string>();
  private subscription: Subscription;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.subscription = this.game.observeUsbBuzzers().subscribe(buzzers => {
      this.buzzers = buzzers;
      for (const path of [...this.chosenColors.keys()]) {
        if (!buzzers.some(buzzer => buzzer.path === path)) {
          this.chosenColors.delete(path);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * As the server names it among the other buzzers once it connected (see UdpBuzzerService), or else by its color
   */
  public getName(buzzer: IUsbBuzzer): string {
    if (!buzzer.macAddress) {
      return 'Funkbuzzer';
    }
    const id = BuzzerHelper.makeUdpBuzzerId(buzzer.macAddress);
    const known = this.game.getAvailableBuzzers().find(available => available.id === id);
    // the server's name follows the heartbeats, which may lag behind a color that was just given
    if (known?.name && known.color === buzzer.color) {
      return known.name;
    }
    return BuzzerHelper.makeUdpBuzzerName(buzzer.macAddress, buzzer.color);
  }

  public getDetails(buzzer: IUsbBuzzer): string {
    const details = ['Über USB angeschlossen'];
    if (buzzer.firmwareVersion) {
      details.push(`Firmware ${buzzer.firmwareVersion}`);
    }
    if (buzzer.color) {
      details.push(`Gehäuse ${BuzzerHelper.getCaseColorName(buzzer.color) ?? buzzer.color}`);
    }
    return details.join(' · ');
  }

  /**
   * Whether the color can be chosen: once the buzzer answered, with a firmware that keeps it
   */
  public canChooseColor(buzzer: IUsbBuzzer): boolean {
    return buzzer.state !== 'identifying' && buzzer.state !== 'adopting' && buzzer.state !== 'no-answer'
      && BuzzerHelper.supportsCaseColor(buzzer.firmwareVersion);
  }

  /**
   * The firmware is known but too old to keep a color
   */
  public needsNewerFirmwareForColor(buzzer: IUsbBuzzer): boolean {
    return buzzer.firmwareVersion != null && !BuzzerHelper.supportsCaseColor(buzzer.firmwareVersion);
  }

  /**
   * The color chosen on the card, or else the one the buzzer has
   */
  public getChosenColor(buzzer: IUsbBuzzer): string | undefined {
    return this.chosenColors.get(buzzer.path) ?? buzzer.color;
  }

  public chooseColor(buzzer: IUsbBuzzer, color: string): void {
    this.chosenColors.set(buzzer.path, color);
  }

  /**
   * Another color was chosen than the buzzer has, which adopting it again gives it
   */
  public isColorChanged(buzzer: IUsbBuzzer): boolean {
    const chosen = this.chosenColors.get(buzzer.path);
    return chosen != null && chosen !== (buzzer.color ?? '');
  }

  public getErrorMessage(error: TUsbBuzzerError): string {
    switch (error) {
      case 'no-wifi-settings':
        return 'Die BuzzerBox kennt die Einstellungen ihres WLANs nicht (/etc/buzzerbox/wireless-buzzers.conf fehlt).';
      case 'no-answer':
        return 'Der Buzzer hat nicht geantwortet. Stecke ihn ab und wieder an und versuche es erneut.';
      case 'rejected':
        return 'Der Buzzer hat die WLAN-Einstellungen abgelehnt.';
      case 'port-error':
      default:
        return 'Die Verbindung über USB ist abgebrochen. Ist der Buzzer noch angesteckt?';
    }
  }

  public adopt(buzzer: IUsbBuzzer): void {
    // without a choice the buzzer keeps its color
    this.game.adoptUsbBuzzer(buzzer.path, this.canChooseColor(buzzer) ? this.chosenColors.get(buzzer.path) : undefined);
    this.chosenColors.delete(buzzer.path);
  }
}
