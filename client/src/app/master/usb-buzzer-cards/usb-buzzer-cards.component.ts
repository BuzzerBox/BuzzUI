import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {BuzzerHelper, IUsbBuzzer, TUsbBuzzerError} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';

/**
 * A card for each wireless buzzer plugged into the box over USB. Adopting one gives it the box's WiFi, after which it
 * connects to the box by itself. A card goes away when its buzzer is unplugged.
 */
@Component({
    selector: 'app-usb-buzzer-cards',
    templateUrl: './usb-buzzer-cards.component.html',
    styleUrls: ['./usb-buzzer-cards.component.css'],
    standalone: false
})
export class UsbBuzzerCardsComponent implements OnInit, OnDestroy {
  public buzzers: IUsbBuzzer[] = [];
  private subscription: Subscription;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.subscription = this.game.observeUsbBuzzers().subscribe(buzzers => this.buzzers = buzzers);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  public getName(buzzer: IUsbBuzzer): string {
    return buzzer.macAddress ? BuzzerHelper.makeUdpBuzzerName(buzzer.macAddress) : 'Funkbuzzer';
  }

  public getDetails(buzzer: IUsbBuzzer): string {
    return buzzer.firmwareVersion ? `Über USB angeschlossen · Firmware ${buzzer.firmwareVersion}` : 'Über USB angeschlossen';
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
    this.game.adoptUsbBuzzer(buzzer.path);
  }
}
