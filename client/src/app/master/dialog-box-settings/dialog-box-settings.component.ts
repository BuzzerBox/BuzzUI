import {Component, OnDestroy, OnInit} from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';
import {Subscription} from 'rxjs';
import {BoxSettingsHelper, IBoxSetting, IBoxSettingsPacket, IBoxSshKey, IResponsePacket, EPacketTypes} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';

interface IBoxSettingField {
  key: string;
  label: string;
  hint?: string;
  // e.g. for the passphrase, which is only shown on request
  isSecret?: boolean;
  options?: IBoxSettingOption[];
  // a list to choose from instead of buttons, for more options than fit in a row
  isSelect?: boolean;
  // only matters with a touch display, so it is hidden without one
  needsTouchDisplay?: boolean;
}

interface IBoxSettingOption {
  value: string;
  label: string;
}

interface IBoxSettingGroup {
  title: string;
  icon: string;
  fields: IBoxSettingField[];
}

/**
 * Shows the box's settings from buzzerbox.txt on its boot partition, and changes them if the file allows it
 * (EDIT_IN_MASTER=true, see BoxSettingsHelper). They count from the box's next start, so it offers to restart it.
 */
@Component({
    selector: 'app-dialog-box-settings',
    templateUrl: './dialog-box-settings.component.html',
    styleUrls: ['./dialog-box-settings.component.css'],
    standalone: false
})
export class DialogBoxSettingsComponent implements OnInit, OnDestroy {
  public readonly editKey = BoxSettingsHelper.EDIT_KEY;
  public readonly groups: IBoxSettingGroup[] = [
    {
      title: 'WLAN', icon: 'wifi', fields: [
        {key: 'WIFI_SSID', label: 'Name des WLANs', hint: '1 bis 32 Zeichen'},
        {key: 'WIFI_PASSPHRASE', label: 'Passwort', hint: '8 bis 63 Zeichen ohne Umlaute', isSecret: true},
        {key: 'WIFI_COUNTRY_CODE', label: 'Land', hint: 'Zwei Buchstaben, z. B. DE, AT oder CH. Davon hängt ab, welche Kanäle erlaubt sind.'},
        {key: 'WIFI_CHANNEL', label: 'Kanal', hint: '1 bis 13'},
        {
          key: 'WIFI_ANTENNA', label: 'Antenne', hint: 'Die externe Antenne gibt es nur beim Compute Module 4.', options: [
            {value: 'internal', label: 'Intern'},
            {value: 'external', label: 'Extern'}
          ]
        }
      ]
    },
    {
      title: 'Buzzer', icon: 'radio_button_checked', fields: [
        {
          key: 'ANALOG_BUZZERS', label: 'Analoge Buzzer',
          hint: 'An die Anschlüsse der Box gesteckte Buzzer. Ohne sie bietet die Box nur die Funkbuzzer an.', options: [
            {value: 'yes', label: 'Ja'},
            {value: 'no', label: 'Nein'}
          ]
        }
      ]
    },
    {
      title: 'Netzwerk', icon: 'lan', fields: [
        {key: 'SERVER_IP_ADDRESS', label: 'Adresse im WLAN', hint: 'Geräte bekommen die Adressen .50 bis .150 desselben Netzes.'},
        {key: 'ETHERNET_IP_ADDRESS', label: 'Adresse am Ethernet-Anschluss', hint: 'Für ein Notebook am Kabel; in einem anderen Netz als das WLAN.'},
        {key: 'SERVER_HOSTNAMES', label: 'Namen der Box', hint: 'Unter diesen Namen lässt sich die Box öffnen, durch Leerzeichen getrennt.'}
      ]
    },
    {
      title: 'Anzeigen', icon: 'tv', fields: [
        {
          key: 'SCREEN_MODE', label: 'Auflösung am Fernseher', isSelect: true,
          hint: 'Bietet der Fernseher die Auflösung nicht an, wählt er selbst. 4K mit 60 Hz schafft ein Raspberry Pi 4 nicht flüssig.',
          options: [
            {value: '1920x1080@60', label: 'Full HD (1920 × 1080), 60 Hz'},
            {value: '1920x1080@50', label: 'Full HD (1920 × 1080), 50 Hz'},
            {value: '1280x720@60', label: 'HD (1280 × 720), 60 Hz'},
            {value: '2560x1440@60', label: 'QHD (2560 × 1440), 60 Hz'},
            {value: '3840x2160@30', label: '4K (3840 × 2160), 30 Hz'},
            {value: 'auto', label: 'Wahl des Fernsehers (oft 4K)'}
          ]
        },
        {
          // only the 10" Touch Display 2 is supported so far, see #129
          key: 'TOUCH_DISPLAY', label: 'Touchscreen',
          hint: 'Mit dem Touchscreen zeigt die Box dort die Spielleitung.', options: [
            {value: '10inch', label: 'Ja'},
            {value: 'none', label: 'Nein'}
          ]
        },
        {
          // only landscape is supported, so it is either way round: 270 is how the box's display is built in
          key: 'TOUCH_DISPLAY_ROTATION', label: 'Drehung des Touch-Displays', needsTouchDisplay: true,
          hint: 'Ja stellt das Bild auf den Kopf, falls der Touchscreen andersherum eingebaut ist.', options: [
            {value: '90', label: 'Ja'},
            {value: '270', label: 'Nein'}
          ]
        },
        {
          key: 'TOUCH_DISPLAY_SCALE', label: 'Größe auf dem Touch-Display', isSelect: true, needsTouchDisplay: true,
          hint: 'Wie groß die Spielleitung auf dem Touch-Display erscheint.',
          options: [
            {value: 'auto', label: 'Automatisch (1,5-fach)'},
            {value: '1', label: 'Normal (1-fach)'},
            {value: '1.25', label: '1,25-fach'},
            {value: '1.5', label: '1,5-fach'},
            {value: '1.75', label: '1,75-fach'},
            {value: '2', label: '2-fach'},
            {value: '2.5', label: '2,5-fach'},
            {value: '3', label: '3-fach'}
          ]
        }
      ]
    }
  ];
  // the values that are offered as buttons and that the box reads in any case
  private static readonly LOWER_CASE_KEYS = ['WIFI_ANTENNA', 'ANALOG_BUZZERS', 'TOUCH_DISPLAY', 'SCREEN_MODE', 'TOUCH_DISPLAY_SCALE'];

  public info: IBoxSettingsPacket | null = null;
  public isEditing = false;
  // the values being edited, by key
  public draft: Record<string, string> = {};
  public isSecretShown = false;
  public isRunning = false;
  public error: string | null = null;
  // saved since the dialog opened, so the box should restart
  public isSaved = false;
  // the WiFi and address to tell the user after saving, if they changed
  public newConnection: {ssid: string, address: string} | null = null;
  // the wireless buzzers get the WiFi and the box's address when they are adopted, so they need them again
  public isBuzzerWifiChanged = false;
  public isConfirmingRestart = false;
  // the public key being pasted, and the key whose removal waits for a confirmation
  public newSshKey = '';
  public confirmingRemoval: string | null = null;
  // why adding or removing a key failed, shown at the keys rather than at the settings
  public sshError: string | null = null;
  public isRestarting = false;
  private subscriptions: Subscription[] = [];

  constructor(private game: GameService, private dialogRef: MatDialogRef<DialogBoxSettingsComponent>) { }

  ngOnInit(): void {
    this.subscriptions.push(
      this.game.observeBoxSettings().subscribe(info => this.info = info),
      this.game.observeBoxSettingsResponses().subscribe(response => this.onResponse(response))
    );
    this.game.requestBoxSettings();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  public getSetting(key: string): IBoxSetting | undefined {
    return this.info?.settings.find(s => s.key === key);
  }

  public getDisplayValue(field: IBoxSettingField): string {
    const value = this.getSetting(field.key)?.value ?? '';
    if (field.isSecret && !this.isSecretShown) {
      return '•'.repeat(Math.max(value.length, 8));
    }
    return field.options?.find(o => o.value === value.toLowerCase())?.label ?? value;
  }

  /**
   * Without a touch display, its settings don't matter: hidden by the saved value, or while editing by the chosen one.
   * Their values stay as they are.
   */
  public getVisibleFields(group: IBoxSettingGroup): IBoxSettingField[] {
    const touchDisplay = this.isEditing ? this.draft['TOUCH_DISPLAY'] : this.getSetting('TOUCH_DISPLAY')?.value;
    const hasTouchDisplay = touchDisplay != null && touchDisplay.toLowerCase() !== 'none';
    return group.fields.filter(field => !field.needsTouchDisplay || hasTouchDisplay);
  }

  /**
   * The field's options, and a value set in the file by hand that isn't one of them, so it stays as it is
   */
  public getOptions(field: IBoxSettingField): IBoxSettingOption[] {
    const value = this.draft[field.key] ?? this.getSetting(field.key)?.value;
    if (value == null || value === '' || field.options.some(o => o.value === value)) {
      return field.options;
    }
    return [...field.options, {value, label: `${value} (aus buzzerbox.txt)`}];
  }

  public startEditing(): void {
    this.draft = {};
    for (const setting of this.info.settings) {
      this.draft[setting.key] = DialogBoxSettingsComponent.LOWER_CASE_KEYS.includes(setting.key) ? setting.value.toLowerCase() : setting.value;
    }
    this.error = null;
    this.isEditing = true;
  }

  public cancelEditing(): void {
    this.isEditing = false;
    this.error = null;
  }

  public isValid(key: string): boolean {
    return BoxSettingsHelper.isValid(key, this.draft[key]);
  }

  public isEthernetInWifiNetwork(): boolean {
    return this.isValid('SERVER_IP_ADDRESS') && this.isValid('ETHERNET_IP_ADDRESS')
      && BoxSettingsHelper.isSameNetwork(this.draft['SERVER_IP_ADDRESS'], this.draft['ETHERNET_IP_ADDRESS']);
  }

  public getChanges(): Record<string, string> {
    const changes: Record<string, string> = {};
    for (const setting of this.info?.settings ?? []) {
      const value = this.draft[setting.key];
      // a default stands in for a missing or invalid value, so saving it writes it into the file
      if (value !== setting.value || setting.invalidValue != null) {
        changes[setting.key] = value;
      }
    }
    return changes;
  }

  public canSave(): boolean {
    return !this.isRunning && Object.keys(this.getChanges()).length > 0
      && this.info.settings.every(s => this.isValid(s.key)) && !this.isEthernetInWifiNetwork();
  }

  public save(): void {
    if (!this.canSave()) {
      return;
    }
    const changes = this.getChanges();
    const isConnectionChanged = ['WIFI_SSID', 'WIFI_PASSPHRASE', 'SERVER_IP_ADDRESS', 'SERVER_HOSTNAMES'].some(key => key in changes);
    this.newConnection = isConnectionChanged
      ? {ssid: this.draft['WIFI_SSID'], address: this.draft['SERVER_HOSTNAMES'].split(/\s+/)[0] || this.draft['SERVER_IP_ADDRESS']}
      : this.newConnection;
    this.isBuzzerWifiChanged ||= ['WIFI_SSID', 'WIFI_PASSPHRASE', 'SERVER_IP_ADDRESS'].some(key => key in changes);
    this.run();
    this.game.saveBoxSettings(changes);
  }

  /**
   * The hardware as label and value, leaving out what the server doesn't know
   */
  public getHardwareRows(): {label: string, value: string}[] {
    const hardware = this.info?.hardware;
    if (hardware == null) {
      return [];
    }
    const storageKinds = {emmc: 'eMMC', sd: 'SD-Karte', usb: 'USB-Laufwerk', other: 'Laufwerk'};
    const rows: {label: string, value: string | null}[] = [
      {label: 'Modell', value: hardware.model ?? null},
      {label: 'Seriennummer', value: hardware.serialNumber ?? null},
      // Linux keeps some memory for itself, so a 4 GB board tells about 3.7 GB
      {label: 'Arbeitsspeicher', value: hardware.memoryInBytes != null ? `${Math.ceil(hardware.memoryInBytes / 1024 ** 3)} GB` : null},
      {
        label: 'Speicher', value: hardware.storage == null ? null : [
          storageKinds[hardware.storage.kind],
          hardware.storage.sizeInBytes != null ? DialogBoxSettingsComponent.formatGigabytes(hardware.storage.sizeInBytes) : null,
          hardware.storage.freeInBytes != null ? `${DialogBoxSettingsComponent.formatGigabytes(hardware.storage.freeInBytes)} frei` : null
        ].filter(part => part != null).join(', ')
      },
      {label: 'Temperatur', value: hardware.temperatureInCelsius != null ? `${hardware.temperatureInCelsius.toLocaleString('de-DE')} °C` : null},
      {label: 'Betriebssystem', value: hardware.operatingSystem ?? null},
      {label: 'Läuft seit', value: hardware.uptimeInSeconds != null ? DialogBoxSettingsComponent.formatDuration(hardware.uptimeInSeconds) : null},
      {label: 'Software', value: hardware.softwareVersion != null ? `Version ${hardware.softwareVersion}` : null}
    ];
    return rows.filter(row => row.value != null && row.value !== '') as {label: string, value: string}[];
  }

  private static formatGigabytes(bytes: number): string {
    const gigabytes = bytes / 1000 ** 3;
    return `${gigabytes.toLocaleString('de-DE', {maximumFractionDigits: gigabytes < 10 ? 1 : 0})} GB`;
  }

  private static formatDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds % 86400 / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    if (days > 0) {
      return `${days} ${days === 1 ? 'Tag' : 'Tagen'}, ${hours} Std.`;
    }
    return hours > 0 ? `${hours} Std. ${minutes} Min.` : `${minutes} Min.`;
  }

  /**
   * Whether the pasted text looks like a key the box takes; the server checks it fully
   */
  public isNewSshKeyValid(): boolean {
    return BoxSettingsHelper.parseSshKey(this.newSshKey) != null && !BoxSettingsHelper.isPrivateKey(this.newSshKey);
  }

  public isNewSshKeyPrivate(): boolean {
    return BoxSettingsHelper.isPrivateKey(this.newSshKey);
  }

  public addSshKey(): void {
    if (this.isRunning || !this.isNewSshKeyValid()) {
      return;
    }
    this.run();
    this.game.addSshKey(this.newSshKey.trim());
  }

  public removeSshKey(key: IBoxSshKey): void {
    this.confirmingRemoval = null;
    this.run();
    this.game.removeSshKey(key.fingerprint);
  }

  /**
   * The address to log in at, the box's first name
   */
  public getSshAddress(): string {
    const names = this.getSetting('SERVER_HOSTNAMES')?.value ?? '';
    return names.split(/\s+/)[0] || this.getSetting('SERVER_IP_ADDRESS')?.value || '';
  }

  public restart(): void {
    this.isConfirmingRestart = false;
    this.run();
    this.game.restartBox();
  }

  private run(): void {
    this.isRunning = true;
    this.error = null;
    this.dialogRef.disableClose = true;
  }

  private onResponse(response: IResponsePacket): void {
    this.isRunning = false;
    this.dialogRef.disableClose = false;
    const isSshResponse = [EPacketTypes.ADD_SSH_KEY, EPacketTypes.REMOVE_SSH_KEY].includes(response.responseTo);
    if (isSshResponse) {
      this.sshError = response.wasSuccessful ? null : response.reason ?? 'Das hat nicht geklappt.';
      if (response.wasSuccessful && response.responseTo === EPacketTypes.ADD_SSH_KEY) {
        this.newSshKey = '';
      }
      return;
    }
    if (!response.wasSuccessful) {
      this.error = response.reason ?? 'Das hat nicht geklappt.';
      return;
    }
    if (response.responseTo === EPacketTypes.SAVE_BOX_SETTINGS) {
      this.isSaved = true;
      this.isEditing = false;
    } else if (response.responseTo === EPacketTypes.RESTART_BOX) {
      // this page connects again by itself once the box is back
      this.isRestarting = true;
    }
  }
}
