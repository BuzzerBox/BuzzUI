import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {Observable, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {DialogConfirmComponent, IDialogConfirmData} from '../../shared/dialog-confirm/dialog-confirm.component';
import {BoxSettingsHelper, IBoxSetting, IBoxSettingsPacket, IBoxSshKey, IResponsePacket, EPacketTypes} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {t, tn} from '../../i18n/i18n';
import {FormatHelper} from '../../helper/format.helper';
import {CLIENT_EXTENSIONS} from '../../extensions/extensions';
import {IBoxSettingField, IBoxSettingGroup, IBoxSettingOption} from './box-setting-fields';

/**
 * Shows the box's settings from buzzerbox.txt on its boot partition, and changes them if the file allows it
 * (EDIT_IN_MASTER=true, see BoxSettingsHelper). They count from the box's next start, so it offers to restart it.
 * A page of its own behind the gear icon of the home page's toolbar.
 */
@Component({
    selector: 'app-box-settings',
    templateUrl: './box-settings.component.html',
    styleUrls: ['./box-settings.component.css'],
    standalone: false
})
export class BoxSettingsComponent implements OnInit, OnDestroy {
  public readonly editKey = BoxSettingsHelper.EDIT_KEY;
  public readonly groups: IBoxSettingGroup[] = BoxSettingsComponent.withExtensionGroups([
    {
      title: 'boxSettings.groups.wifi', icon: 'wifi', fields: [
        {key: 'WIFI_SSID'},
        {key: 'WIFI_PASSPHRASE', isSecret: true},
        {key: 'WIFI_COUNTRY_CODE'},
        {key: 'WIFI_CHANNEL'},
        {
          key: 'WIFI_ANTENNA', options: [
            {value: 'internal', label: 'boxSettings.options.internal'},
            {value: 'external', label: 'boxSettings.options.external'}
          ]
        }
      ]
    },
    {
      title: 'boxSettings.groups.network', icon: 'lan', fields: [
        {key: 'SERVER_IP_ADDRESS'},
        {key: 'ETHERNET_IP_ADDRESS'},
        {key: 'SERVER_HOSTNAMES'}
      ]
    },
    {
      title: 'boxSettings.groups.displays', icon: 'tv', fields: [
        {
          // the resolutions' names are the same in every language
          key: 'SCREEN_MODE', isSelect: true, options: [
            {value: '1920x1080@60', label: 'Full HD (1920 × 1080), 60 Hz'},
            {value: '1920x1080@50', label: 'Full HD (1920 × 1080), 50 Hz'},
            {value: '1280x720@60', label: 'HD (1280 × 720), 60 Hz'},
            {value: '2560x1440@60', label: 'QHD (2560 × 1440), 60 Hz'},
            {value: '3840x2160@30', label: '4K (3840 × 2160), 30 Hz'},
            {value: 'auto', label: 'boxSettings.options.screenModeAuto'}
          ]
        },
        // only the 10" Touch Display 2 is supported so far, see #129
        {key: 'TOUCH_DISPLAY', options: [
            {value: '10inch', label: 'boxSettings.options.yes'},
            {value: 'none', label: 'boxSettings.options.no'}
          ]},
        // only landscape is supported, so it is either way round: 270 is how the box's display is built in
        {key: 'TOUCH_DISPLAY_ROTATION', needsTouchDisplay: true, options: [
            {value: '90', label: 'boxSettings.options.yes'},
            {value: '270', label: 'boxSettings.options.no'}
          ]},
        {
          key: 'TOUCH_DISPLAY_SCALE', isSelect: true, needsTouchDisplay: true, options: [
            {value: 'auto', label: 'boxSettings.options.scaleAuto', factor: 1.5},
            {value: '1', label: 'boxSettings.options.scaleNormal', factor: 1},
            ...[1.25, 1.5, 1.75, 2, 2.5, 3].map(factor => ({value: String(factor), label: 'boxSettings.options.scale', factor}))
          ]
        }
      ]
    }
  ]);
  // the values that are offered as buttons and that the box reads in any case
  private static readonly LOWER_CASE_KEYS = ['WIFI_ANTENNA', 'TOUCH_DISPLAY', 'SCREEN_MODE', 'TOUCH_DISPLAY_SCALE'];

  public info: IBoxSettingsPacket | null = null;
  public isEditing = false;
  // the values being edited, by key
  public draft: Record<string, string> = {};
  // the draft as editing started, to tell whether anything was changed before leaving the page
  private initialDraft: Record<string, string> = {};
  public isSecretShown = false;
  public isRunning = false;
  // why saving or restarting failed: the server's reason, or '' for none, which shows a general text
  public error: string | null = null;
  // saved since the page opened, so the box should restart
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
  // (like error)
  public sshError: string | null = null;
  public isRestarting = false;
  private subscriptions: Subscription[] = [];

  constructor(private game: GameService, private dialog: MatDialog) { }

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
    const option = field.options?.find(o => o.value === value.toLowerCase());
    return option ? this.getOptionLabel(option) : value;
  }

  public getOptionLabel(option: IBoxSettingOption): string {
    const params = option.factor != null ? {factor: FormatHelper.formatNumber(option.factor)} : option.params;
    return t(option.label, params);
  }

  public getLabel(field: IBoxSettingField): string {
    return t(`boxSettings.fields.${field.key}.label`);
  }

  public getHint(field: IBoxSettingField): string {
    return t(`boxSettings.fields.${field.key}.hint`);
  }

  /**
   * Parameters for a text in [innerHTML], escaped, since the WiFi's name and the address are typed in
   */
  public escaped(params: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, FormatHelper.escapeHtml(value ?? '')]));
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
    return [...field.options, {value, label: 'boxSettings.fromFile', params: {value}}];
  }

  public startEditing(): void {
    this.draft = {};
    for (const setting of this.info.settings) {
      this.draft[setting.key] = this.isLowerCase(setting.key) ? setting.value.toLowerCase() : setting.value;
    }
    this.initialDraft = {...this.draft};
    this.error = null;
    this.isEditing = true;
  }

  /**
   * Whether editing changed something that isn't saved yet
   */
  public hasUnsavedChanges(): boolean {
    return this.isEditing && Object.keys(this.draft).some(key => this.draft[key] !== this.initialDraft[key]);
  }

  /**
   * For the route's canDeactivate: leaving with unsaved changes asks first
   */
  public canLeave(): boolean | Observable<boolean> {
    if (!this.hasUnsavedChanges()) {
      return true;
    }
    return this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {
        title: t('boxSettings.confirmLeave.title'),
        message: t('boxSettings.confirmLeave.message'),
        confirmText: t('boxSettings.confirmLeave.confirm')
      }
    }).afterClosed().pipe(map(confirmed => confirmed === true));
  }

  /**
   * Reloading or closing the page (also the toolbar's logout, which loads /choose) gets the browser's own question
   */
  @HostListener('window:beforeunload', ['$event'])
  public onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
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
    const storage = hardware.storage;
    const rows: {label: string, value: string | null}[] = [
      {label: 'model', value: hardware.model ?? null},
      {label: 'serialNumber', value: hardware.serialNumber ?? null},
      // Linux keeps some memory for itself, so a 4 GB board tells about 3.7 GB
      {label: 'memory', value: hardware.memoryInBytes != null ? `${Math.ceil(hardware.memoryInBytes / 1024 ** 3)} GB` : null},
      {
        label: 'storage', value: storage == null ? null : [
          // "other" would look like the plural form of a text with a number, see pluralKey()
          t(`boxSettings.hardware.storageKinds.${storage.kind === 'other' ? 'drive' : storage.kind}`),
          storage.sizeInBytes != null ? BoxSettingsComponent.formatGigabytes(storage.sizeInBytes) : null,
          storage.freeInBytes != null ? t('boxSettings.hardware.free', {size: BoxSettingsComponent.formatGigabytes(storage.freeInBytes)}) : null
        ].filter(part => part != null).join(', ')
      },
      {label: 'temperature', value: hardware.temperatureInCelsius != null ? `${FormatHelper.formatNumber(hardware.temperatureInCelsius)} °C` : null},
      {label: 'operatingSystem', value: hardware.operatingSystem ?? null},
      {label: 'uptime', value: hardware.uptimeInSeconds != null ? BoxSettingsComponent.formatDuration(hardware.uptimeInSeconds) : null},
      {label: 'software', value: hardware.softwareVersion != null ? t('common.version', {version: hardware.softwareVersion}) : null}
    ];
    return rows
      .filter(row => row.value != null && row.value !== '')
      .map(row => ({label: t(`boxSettings.hardware.${row.label}`), value: row.value}));
  }

  private static formatGigabytes(bytes: number): string {
    const gigabytes = bytes / 1000 ** 3;
    return `${FormatHelper.formatNumber(gigabytes, {maximumFractionDigits: gigabytes < 10 ? 1 : 0})} GB`;
  }

  private static formatDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds % 86400 / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    if (days > 0) {
      return tn('boxSettings.hardware.days', days, {hours});
    }
    return hours > 0 ? t('boxSettings.hardware.hours', {hours, minutes}) : t('boxSettings.hardware.minutes', {minutes});
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
  }

  private onResponse(response: IResponsePacket): void {
    this.isRunning = false;
    const isSshResponse = [EPacketTypes.ADD_SSH_KEY, EPacketTypes.REMOVE_SSH_KEY].includes(response.responseTo);
    if (isSshResponse) {
      this.sshError = response.wasSuccessful ? null : response.reason ?? '';
      if (response.wasSuccessful && response.responseTo === EPacketTypes.ADD_SSH_KEY) {
        this.newSshKey = '';
      }
      return;
    }
    if (!response.wasSuccessful) {
      this.error = response.reason ?? '';
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

  /**
   * The groups of the core with those of the extensions, each after the group it names, see IBoxSettingGroup.after
   */
  private static withExtensionGroups(groups: IBoxSettingGroup[]): IBoxSettingGroup[] {
    const result = [...groups];
    for (const group of CLIENT_EXTENSIONS.flatMap(extension => extension.boxSettingGroups ?? [])) {
      const index = group.after == null ? -1 : result.findIndex(other => other.title === group.after);
      result.splice(index < 0 ? result.length : index + 1, 0, group);
    }
    return result;
  }

  private isLowerCase(key: string): boolean {
    return BoxSettingsComponent.LOWER_CASE_KEYS.includes(key)
      || this.groups.some(group => group.fields.some(field => field.key === key && field.isLowerCase));
  }
}
