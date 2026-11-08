import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideZoneChangeDetection} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectModule} from '@angular/material/select';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ReplaySubject, Subject} from 'rxjs';
import {BoxSettingsHelper, EPacketTypes, IBoxSettingsPacket, IResponsePacket} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {DialogBoxSettingsComponent} from './dialog-box-settings.component';

describe('DialogBoxSettingsComponent', () => {
  let fixture: ComponentFixture<DialogBoxSettingsComponent>;
  let settings: ReplaySubject<IBoxSettingsPacket>;
  let responses: Subject<IResponsePacket>;
  let game: jasmine.SpyObj<GameService>;

  const makeInfo = (editable: boolean): IBoxSettingsPacket => ({
    packetType: EPacketTypes.BOX_SETTINGS,
    available: true,
    editable,
    canRestart: true,
    sshAvailable: true,
    hardware: {
      model: 'Raspberry Pi Compute Module 4 Rev 1.1', serialNumber: '10000000abcd1234', memoryInBytes: 3.7 * 1024 ** 3,
      storage: {kind: 'emmc', sizeInBytes: 31268536320, freeInBytes: 24.5e9}, temperatureInCelsius: 48.7,
      operatingSystem: 'Debian GNU/Linux 12 (bookworm)', uptimeInSeconds: 93780, softwareVersion: '1.5.0'
    },
    sshUser: 'admin',
    sshKeys: [
      {type: 'ssh-ed25519', comment: 'liam@laptop', fingerprint: 'SHA256:6iLO/SEl+BlsaAwyCEzfYi5TBlXITaBEufJshxKMRN8', isActive: true},
      {type: 'ssh-rsa', comment: '', fingerprint: 'SHA256:0Lf4TGfPQJLDihjlm4Rf+LSRHUHnAqg+Mr/m6ED6DVU', isActive: false}
    ],
    settings: BoxSettingsHelper.KEYS.map(key => key === 'WIFI_CHANNEL'
      ? {key, value: '8', isDefault: true, invalidValue: '99'}
      : {key, value: BoxSettingsHelper.DEFAULTS[key], isDefault: false})
  });

  beforeEach(async () => {
    settings = new ReplaySubject(1);
    responses = new Subject();
    game = jasmine.createSpyObj<GameService>('GameService', ['observeBoxSettings', 'observeBoxSettingsResponses',
      'requestBoxSettings', 'saveBoxSettings', 'restartBox', 'addSshKey', 'removeSshKey']);
    game.observeBoxSettings.and.returnValue(settings);
    game.observeBoxSettingsResponses.and.returnValue(responses);
    await TestBed.configureTestingModule({
      declarations: [DialogBoxSettingsComponent],
      imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule,
        MatInputModule, MatProgressSpinnerModule, MatSelectModule, NoopAnimationsModule],
      providers: [
        provideZoneChangeDetection(),
        {provide: GameService, useValue: game},
        {provide: MatDialogRef, useValue: {disableClose: false}}
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(DialogBoxSettingsComponent);
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent;
  const buttons = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map(b => b.textContent.trim());

  it('shows the settings without letting them be changed by default', () => {
    fixture.detectChanges();
    expect(game.requestBoxSettings).toHaveBeenCalled();
    settings.next(makeInfo(false));
    fixture.detectChanges();
    expect(text()).toContain('BuzzerBoxNetwork');
    expect(text()).not.toContain('12TheBuzzerBox_IncredibleNetwork34');
    expect(text()).toContain('„99“ in der Datei ist ungültig');
    expect(text()).toContain('EDIT_IN_MASTER=true');
    expect(buttons().some(b => b.includes('Bearbeiten'))).toBeFalse();
  });

  it('saves only the changed settings when the file allows editing', () => {
    fixture.detectChanges();
    settings.next(makeInfo(true));
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.startEditing();
    component.draft['WIFI_SSID'] = 'Quiz Abend';
    fixture.detectChanges();
    expect(component.canSave()).toBeTrue();
    component.save();
    // the invalid channel in the file is replaced by the default the box uses
    expect(game.saveBoxSettings).toHaveBeenCalledWith({WIFI_SSID: 'Quiz Abend', WIFI_CHANNEL: '8'});
    responses.next({packetType: EPacketTypes.RESPONSE_PACKET, responseTo: EPacketTypes.SAVE_BOX_SETTINGS, wasSuccessful: true});
    fixture.detectChanges();
    expect(text()).toContain('Gespeichert');
    expect(text()).toContain('„Quiz Abend“');
    expect(buttons().some(b => b.includes('Jetzt neu starten'))).toBeTrue();
  });

  it('offers the resolution and scale as a choice, keeping a value set by hand', () => {
    fixture.detectChanges();
    const info = makeInfo(true);
    info.settings.find(s => s.key === 'TOUCH_DISPLAY').value = '7inch';
    info.settings.find(s => s.key === 'TOUCH_DISPLAY_SCALE').value = '1.3';
    settings.next(info);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(text()).toContain('Full HD (1920 × 1080), 60 Hz');
    component.startEditing();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('mat-select').length).toBe(2);
    const scale = component.groups.flatMap(g => g.fields).find(f => f.key === 'TOUCH_DISPLAY_SCALE');
    expect(component.getOptions(scale).map(o => o.value)).toContain('1.3');
    expect(component.getChanges()).toEqual({WIFI_CHANNEL: '8'});
  });

  it('shows the touch display\'s settings only with a touch display', () => {
    fixture.detectChanges();
    settings.next(makeInfo(true));
    fixture.detectChanges();
    expect(text()).toContain('Touchscreen');
    expect(text()).not.toContain('Drehung des Touch-Displays');
    expect(text()).not.toContain('Größe auf dem Touch-Display');
    const component = fixture.componentInstance;
    component.startEditing();
    component.draft['TOUCH_DISPLAY'] = '10inch';
    fixture.detectChanges();
    expect(text()).toContain('Drehung des Touch-Displays');
    expect(text()).toContain('Größe auf dem Touch-Display');
    expect(component.getChanges()).toEqual({TOUCH_DISPLAY: '10inch', WIFI_CHANNEL: '8'});
  });

  it('offers only the 10" touch display in landscape, keeping another one set by hand', () => {
    fixture.detectChanges();
    const info = makeInfo(true);
    info.settings.find(s => s.key === 'TOUCH_DISPLAY').value = '7inch';
    info.settings.find(s => s.key === 'TOUCH_DISPLAY_ROTATION').value = '0';
    settings.next(info);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.startEditing();
    const field = (key: string) => component.groups.flatMap(g => g.fields).find(f => f.key === key);
    expect(field('TOUCH_DISPLAY').options).toEqual([{value: '10inch', label: 'Ja'}, {value: 'none', label: 'Nein'}]);
    expect(field('TOUCH_DISPLAY_ROTATION').options).toEqual([{value: '90', label: 'Ja'}, {value: '270', label: 'Nein'}]);
    expect(component.getOptions(field('TOUCH_DISPLAY')).map(o => o.value)).toEqual(['10inch', 'none', '7inch']);
    expect(component.getOptions(field('TOUCH_DISPLAY_ROTATION')).map(o => o.value)).toEqual(['90', '270', '0']);
  });

  it('lists the SSH keys, and only lets them be changed when the file allows it', () => {
    fixture.detectChanges();
    settings.next(makeInfo(false));
    fixture.detectChanges();
    expect(text()).toContain('liam@laptop');
    expect(text()).toContain('SHA256:6iLO/SEl+BlsaAwyCEzfYi5TBlXITaBEufJshxKMRN8');
    expect(text()).toContain('Schlüssel ohne Namen');
    expect(text()).toContain('Gilt ab dem nächsten Start');
    expect(text()).toContain('ssh admin@buzzer.box');
    expect(text()).not.toContain('Öffentlichen Schlüssel hinzufügen');
    expect((fixture.nativeElement as HTMLElement).querySelector('button[title="Schlüssel entfernen"]')).toBeNull();
  });

  it('adds and removes SSH keys, refusing private keys', () => {
    fixture.detectChanges();
    settings.next(makeInfo(true));
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.newSshKey = '-----BEGIN OPENSSH PRIVATE KEY-----';
    fixture.detectChanges();
    expect(component.isNewSshKeyValid()).toBeFalse();
    expect(text()).toContain('privater Schlüssel');
    component.newSshKey = '  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGuDDwzxcMtqEwoThXNRhoXr new@pc\n';
    expect(component.isNewSshKeyValid()).toBeTrue();
    component.addSshKey();
    expect(game.addSshKey).toHaveBeenCalledWith('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGuDDwzxcMtqEwoThXNRhoXr new@pc');
    responses.next({packetType: EPacketTypes.RESPONSE_PACKET, responseTo: EPacketTypes.ADD_SSH_KEY, wasSuccessful: true});
    expect(component.newSshKey).toBe('');
    component.removeSshKey(component.info.sshKeys[1]);
    expect(game.removeSshKey).toHaveBeenCalledWith('SHA256:0Lf4TGfPQJLDihjlm4Rf+LSRHUHnAqg+Mr/m6ED6DVU');
    responses.next({packetType: EPacketTypes.RESPONSE_PACKET, responseTo: EPacketTypes.REMOVE_SSH_KEY, wasSuccessful: false, reason: 'Kaputt'});
    fixture.detectChanges();
    expect(text()).toContain('Kaputt');
  });

  it('shows the hardware', () => {
    fixture.detectChanges();
    settings.next(makeInfo(false));
    fixture.detectChanges();
    expect(text()).toContain('Raspberry Pi Compute Module 4 Rev 1.1');
    expect(text()).toContain('10000000abcd1234');
    expect(text()).toContain('4 GB');
    expect(text()).toContain('eMMC, 31 GB, 25 GB frei');
    expect(text()).toContain('48,7 °C');
    expect(text()).toContain('1 Tag, 2 Std.');
  });

  it('sets whether the box has analog buzzers', () => {
    fixture.detectChanges();
    settings.next(makeInfo(true));
    fixture.detectChanges();
    expect(text()).toContain('Analoge Buzzer');
    const component = fixture.componentInstance;
    const field = component.groups.flatMap(g => g.fields).find(f => f.key === 'ANALOG_BUZZERS');
    expect(component.getDisplayValue(field)).toBe('Ja');
    component.startEditing();
    component.draft['ANALOG_BUZZERS'] = 'no';
    expect(component.getChanges()).toEqual({ANALOG_BUZZERS: 'no', WIFI_CHANNEL: '8'});
  });

  it('keeps the SSH keys usable while the settings are edited, but hides the hardware', () => {
    fixture.detectChanges();
    settings.next(makeInfo(true));
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.startEditing();
    fixture.detectChanges();
    expect(text()).toContain('liam@laptop');
    expect(text()).toContain('„Speichern“ und „Abbrechen“ betreffen sie nicht');
    expect(text()).toContain('Öffentlichen Schlüssel hinzufügen');
    expect(text()).not.toContain('Raspberry Pi Compute Module 4');
    component.newSshKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGuDDwzxcMtqEwoThXNRhoXr new@pc';
    component.addSshKey();
    expect(game.addSshKey).toHaveBeenCalled();
    responses.next({packetType: EPacketTypes.RESPONSE_PACKET, responseTo: EPacketTypes.ADD_SSH_KEY, wasSuccessful: true});
    // the settings being edited stay as they were
    expect(component.isEditing).toBeTrue();
    expect(component.isSaved).toBeFalse();
  });

  it('refuses an Ethernet address in the WiFi network', () => {
    fixture.detectChanges();
    settings.next(makeInfo(true));
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.startEditing();
    component.draft['ETHERNET_IP_ADDRESS'] = '10.0.0.7';
    fixture.detectChanges();
    expect(component.canSave()).toBeFalse();
    expect(text()).toContain('anderen Netz');
  });
});
