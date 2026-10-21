import {Component, OnDestroy, OnInit} from '@angular/core';
import {combineLatest, defer, Subscription} from 'rxjs';
import {startWith} from 'rxjs/operators';
import {BuzzerHelper, IBuzzer, ICaseColor, IUsbBuzzer, TUsbBuzzerError} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';

/**
 * A connected wireless buzzer: plugged into the box over USB, talking to it over WiFi, or both
 */
export interface IWirelessBuzzerRow {
  /** IUsbBuzzer.path while it is plugged in, or else its ID */
  key: string;
  /** While it is plugged in over USB: what the box found out there, and adopting it */
  usb?: IUsbBuzzer;
  /** While it talks to the server over WiFi (UdpBuzzerService) */
  wifi?: IBuzzer;
}

/**
 * The wireless buzzers that are connected to the box, with their color, firmware, battery and how they are connected.
 * Those plugged in over USB can be adopted there, which gives them the box's WiFi, after which they connect to the box
 * by itself. The color of the case is chosen there too; the buzzer keeps it and its team has it on the screens.
 */
@Component({
    selector: 'app-wireless-buzzers',
    templateUrl: './wireless-buzzers.component.html',
    styleUrls: ['./wireless-buzzers.component.css'],
    standalone: false
})
export class WirelessBuzzersComponent implements OnInit, OnDestroy {
  public readonly caseColors: ICaseColor[] = BuzzerHelper.CASE_COLORS;
  public rows: IWirelessBuzzerRow[] = [];
  // the color chosen for a buzzer plugged in over USB, by IUsbBuzzer.path, until it is unplugged
  private readonly chosenColors = new Map<string, string>();
  // the buzzers plugged in over USB, by IUsbBuzzer.path, whose color is changed through the menu, until it is unplugged
  private readonly colorChanges = new Set<string>();
  private subscription: Subscription;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    const availableBuzzers = defer(() => this.game.observeAvailableBuzzers().pipe(startWith(this.game.getAvailableBuzzers())));
    this.subscription = combineLatest([this.game.observeUsbBuzzers(), availableBuzzers]).subscribe(([usbBuzzers, buzzers]) => {
      this.rows = WirelessBuzzersComponent.makeRows(usbBuzzers, buzzers);
      for (const path of [...this.chosenColors.keys()]) {
        if (!usbBuzzers.some(buzzer => buzzer.path === path)) {
          this.chosenColors.delete(path);
        }
      }
      for (const path of [...this.colorChanges]) {
        if (!usbBuzzers.some(buzzer => buzzer.path === path)) {
          this.colorChanges.delete(path);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Those plugged in over USB first, so that one that connects over WiFi while it is adopted stays where it is; then
   * those that are online over WiFi, in the server's order
   */
  public static makeRows(usbBuzzers: IUsbBuzzer[], buzzers: IBuzzer[]): IWirelessBuzzerRow[] {
    const online = buzzers.filter(buzzer => buzzer.type === 'udp' && buzzer.online);
    const plugged = usbBuzzers.map(usb => {
      const id = usb.macAddress ? BuzzerHelper.makeUdpBuzzerId(usb.macAddress) : undefined;
      return {key: usb.path, usb, wifi: online.find(buzzer => buzzer.id === id)};
    });
    const wifiOnly = online
      .filter(buzzer => !plugged.some(row => row.wifi === buzzer))
      .map(buzzer => ({key: buzzer.id, wifi: buzzer}));
    return [...plugged, ...wifiOnly];
  }

  /**
   * As the server names it among the other buzzers, or else by its color
   */
  public getName(row: IWirelessBuzzerRow): string {
    const usb = row.usb;
    if (usb == null) {
      return row.wifi.name;
    }
    if (!usb.macAddress) {
      return 'Funkbuzzer';
    }
    const id = BuzzerHelper.makeUdpBuzzerId(usb.macAddress);
    const known = row.wifi ?? this.game.getAvailableBuzzers().find(available => available.id === id);
    // the server's name follows the heartbeats, which may lag behind a color that was just given
    if (known?.name && known.color === usb.color) {
      return known.name;
    }
    return BuzzerHelper.makeUdpBuzzerName(usb.macAddress, usb.color);
  }

  /**
   * Over USB the buzzer tells its color right away, also one that it was just given
   */
  public getColor(row: IWirelessBuzzerRow): string | undefined {
    return row.usb ? row.usb.color : row.wifi?.color;
  }

  public getFirmwareVersion(row: IWirelessBuzzerRow): string | undefined {
    return row.wifi?.firmwareVersion ?? row.usb?.firmwareVersion;
  }

  public getBatteryPercent(row: IWirelessBuzzerRow): number | undefined {
    return row.wifi?.batteryPercent;
  }

  public hasBatteryPercent(row: IWirelessBuzzerRow): boolean {
    return this.getBatteryPercent(row) != null;
  }

  public isBatteryLow(row: IWirelessBuzzerRow): boolean {
    return row.wifi?.batteryLow === true;
  }

  /**
   * A Material icon for the battery: charging over USB, or the bars of its charge
   */
  public getBatteryIcon(row: IWirelessBuzzerRow): string {
    const percent = this.getBatteryPercent(row);
    if (row.usb) {
      return 'battery_charging_full';
    }
    if (percent == null) {
      return this.isBatteryLow(row) ? 'battery_alert' : 'battery_unknown';
    }
    if (percent >= 95) {
      return 'battery_full';
    }
    // battery_0_bar to battery_6_bar
    return `battery_${Math.min(6, Math.floor(percent / 100 * 7))}_bar`;
  }

  /**
   * Whether the color can be chosen: once the buzzer answered over USB, with a firmware that keeps it
   */
  public canChooseColor(buzzer: IUsbBuzzer): boolean {
    return buzzer.state !== 'identifying' && buzzer.state !== 'adopting' && buzzer.state !== 'no-answer'
      && BuzzerHelper.supportsCaseColor(buzzer.firmwareVersion);
  }

  /**
   * The buzzer was set up before, by this box or another one: it has a WiFi or a color, which is then taken to be right
   */
  public isInitialized(buzzer: IUsbBuzzer): boolean {
    return !!buzzer.ssid || !!buzzer.color;
  }

  /**
   * The colors are shown right away for a buzzer that wasn't set up yet, and else once they were asked for in the menu
   */
  public isColorPickerShown(buzzer: IUsbBuzzer): boolean {
    return this.canChooseColor(buzzer) && (!this.isInitialized(buzzer) || this.colorChanges.has(buzzer.path));
  }

  /**
   * The menu offers to change the color of a buzzer that was set up before
   */
  public hasColorMenu(buzzer: IUsbBuzzer): boolean {
    return this.canChooseColor(buzzer) && this.isInitialized(buzzer);
  }

  public isChangingColor(buzzer: IUsbBuzzer): boolean {
    return this.colorChanges.has(buzzer.path);
  }

  /**
   * Shows the colors, or hides them again and forgets the color chosen there
   */
  public toggleColorChange(buzzer: IUsbBuzzer): void {
    if (this.colorChanges.delete(buzzer.path)) {
      this.chosenColors.delete(buzzer.path);
    } else {
      this.colorChanges.add(buzzer.path);
    }
  }

  /**
   * The firmware is known but too old to keep a color
   */
  public needsNewerFirmwareForColor(buzzer: IUsbBuzzer): boolean {
    return buzzer.firmwareVersion != null && !BuzzerHelper.supportsCaseColor(buzzer.firmwareVersion);
  }

  /**
   * The color chosen for the buzzer, or else the one it has
   */
  public getChosenColor(buzzer: IUsbBuzzer): string | undefined {
    return this.chosenColors.get(buzzer.path) ?? buzzer.color;
  }

  /**
   * A light color, on which the check mark is dark
   */
  public isLight(color: string): boolean {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b > 186;
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

  /**
   * There is a button for the buzzer: to adopt it (again), or to give it the color that was chosen
   */
  public hasActions(buzzer: IUsbBuzzer): boolean {
    if ((buzzer.state === 'detected' && buzzer.isAdopted) || buzzer.state === 'adopted') {
      return this.isColorChanged(buzzer) || buzzer.state === 'detected';
    }
    return buzzer.state === 'detected' || buzzer.state === 'no-answer' || buzzer.state === 'failed';
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
    this.colorChanges.delete(buzzer.path);
  }
}
