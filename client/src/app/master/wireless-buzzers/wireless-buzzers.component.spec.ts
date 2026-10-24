import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideZoneChangeDetection} from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatMenuModule} from '@angular/material/menu';
import {IBuzzer, IUsbBuzzer} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {WirelessBuzzersComponent} from './wireless-buzzers.component';
import {BuzzerColorComponent} from '../buzzer-color/buzzer-color.component';

describe('WirelessBuzzersComponent', () => {
  let fixture: ComponentFixture<WirelessBuzzersComponent>;
  let usbBuzzers: BehaviorSubject<IUsbBuzzer[]>;
  let availableBuzzers: Subject<IBuzzer[]>;
  let game: jasmine.SpyObj<GameService>;

  const udp = (mac: string, more: Partial<IBuzzer> = {}): IBuzzer =>
    ({id: 'udp:' + mac, name: 'Funkbuzzer ' + mac.slice(-5), keyBind: '', byteBind: '', type: 'udp', online: true, ...more});

  beforeEach(async () => {
    usbBuzzers = new BehaviorSubject<IUsbBuzzer[]>([]);
    availableBuzzers = new Subject<IBuzzer[]>();
    game = jasmine.createSpyObj<GameService>('GameService',
      ['observeUsbBuzzers', 'observeAvailableBuzzers', 'adoptUsbBuzzer', 'getAvailableBuzzers']);
    game.observeUsbBuzzers.and.returnValue(usbBuzzers.asObservable());
    game.observeAvailableBuzzers.and.returnValue(availableBuzzers.asObservable());
    game.getAvailableBuzzers.and.returnValue([]);
    await TestBed.configureTestingModule({
      declarations: [WirelessBuzzersComponent],
      imports: [BuzzerColorComponent, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatMenuModule],
      providers: [{provide: GameService, useValue: game}, provideZoneChangeDetection()]
    }).compileComponents();
    fixture = TestBed.createComponent(WirelessBuzzersComponent);
    fixture.detectChanges();
  });

  const show = (...list: IUsbBuzzer[]) => {
    usbBuzzers.next(list);
    fixture.detectChanges();
  };
  const online = (...list: IBuzzer[]) => {
    game.getAvailableBuzzers.and.returnValue(list);
    availableBuzzers.next(list);
    fixture.detectChanges();
  };
  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent;
  const rows = () => [...element().querySelectorAll<HTMLElement>('.buzzer')];
  const button = () => element().querySelector<HTMLButtonElement>('.actions button');

  it('shows nothing without buzzers', () => {
    expect(element().querySelector('mat-card')).toBeNull();
  });

  describe('the list', () => {
    it('shows the buzzers that are online over WiFi, with their color, firmware and battery', () => {
      online(
        {id: 'b0', name: 'Buzzer 1', keyBind: '', byteBind: '', type: 'serial'},
        udp('AA:BB:CC:DD:EE:01', {name: 'Blauer Wireless Buzzer', color: '#1e88e5', firmwareVersion: '1.3.0', batteryPercent: 87}),
        udp('AA:BB:CC:DD:EE:02', {online: false}),
        udp('AA:BB:CC:DD:EE:03', {firmwareVersion: '1.2.0', batteryLow: true})
      );
      expect(rows().length).toBe(2);
      expect(rows()[0].textContent).toContain('Blauer Wireless Buzzer');
      expect(rows()[0].textContent).toContain('WLAN');
      expect(rows()[0].textContent).not.toContain('USB');
      expect(rows()[0].textContent).toContain('87 %');
      expect(rows()[0].textContent).toContain('Firmware 1.3.0');
      expect(rows()[0].querySelector('app-buzzer-color')).not.toBeNull();
      expect(rows()[1].textContent).toContain('Funkbuzzer EE:03');
      expect(rows()[1].textContent).toContain('schwach');
      expect(rows()[1].querySelector('app-buzzer-color')).toBeNull();
      expect(text()).toContain('2 Buzzer sind verbunden');
      expect(button()).toBeNull();
    });

    it('shows a buzzer that is plugged in and online once, with both connections, first', () => {
      online(udp('AA:BB:CC:DD:EE:01', {batteryPercent: 40}), udp('14:2B:2F:AF:8F:DC', {firmwareVersion: '1.3.0', batteryPercent: 55}));
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2b:2f:af:8f:dc', firmwareVersion: '1.3.0',
        ssid: 'BuzzerBoxNetwork', isAdopted: true, isConnected: true});
      expect(rows().length).toBe(2);
      expect(rows()[0].textContent).toContain('Funkbuzzer 8F:DC');
      expect(rows()[0].textContent).toContain('USB');
      expect(rows()[0].textContent).toContain('WLAN');
      expect(rows()[0].textContent).toContain('55 %');
      expect(rows()[0].querySelector('.battery mat-icon').textContent).toBe('battery_charging_full');
      expect(rows()[1].textContent).toContain('Funkbuzzer EE:01');
    });

    it('shows a buzzer only plugged in over USB', () => {
      show({path: '/dev/ttyACM0', state: 'identifying'});
      expect(rows().length).toBe(1);
      expect(rows()[0].textContent).toContain('USB');
      expect(rows()[0].textContent).not.toContain('WLAN');
      expect(text()).toContain('Ein Buzzer ist verbunden');
    });

    it('shows the bars of the battery', () => {
      const component = fixture.componentInstance;
      expect(component.getBatteryIcon({key: 'a', wifi: udp('A', {batteryPercent: 100})})).toBe('battery_full');
      expect(component.getBatteryIcon({key: 'a', wifi: udp('A', {batteryPercent: 50})})).toBe('battery_3_bar');
      expect(component.getBatteryIcon({key: 'a', wifi: udp('A', {batteryPercent: 3})})).toBe('battery_0_bar');
      expect(component.getBatteryIcon({key: 'a', wifi: udp('A', {batteryLow: true})})).toBe('battery_alert');
    });
  });

  describe('adopting', () => {
    it('lets a detected buzzer be adopted', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2b:2f:af:8f:dc', firmwareVersion: '1.0.1'});
      expect(text()).toContain('Funkbuzzer 8F:DC');
      expect(text()).toContain('Firmware 1.0.1');
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', undefined);
    });

    it('shows the WiFi it was given, without a button, and when it is connected', () => {
      show({path: '/dev/ttyACM0', state: 'adopted', macAddress: '14:2B:2F:AF:8F:DC', ssid: 'BuzzerBoxNetwork', isAdopted: true});
      expect(text()).toContain('verbindet sich mit dem WLAN „BuzzerBoxNetwork“');
      expect(button()).toBeNull();
      show({path: '/dev/ttyACM0', state: 'adopted', macAddress: '14:2B:2F:AF:8F:DC', ssid: 'BuzzerBoxNetwork', isAdopted: true, isConnected: true});
      expect(text()).toContain('Übernommen und verbunden');
    });

    it('shows a buzzer adopted before, which can be adopted again', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', ssid: 'BuzzerBoxNetwork', isAdopted: true, isConnected: true});
      expect(text()).toContain('Bereits für diese BuzzerBox übernommen (WLAN „BuzzerBoxNetwork“) und verbunden.');
      expect(button().textContent).toContain('Erneut übernehmen');
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', undefined);
    });

    it('tells about the WiFi of another box', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', ssid: 'OtherNetwork', isAdopted: false});
      expect(text()).toContain('für das WLAN „OtherNetwork“ eingerichtet, nicht für diese BuzzerBox');
      expect(button().textContent).toContain('Übernehmen');
    });

    it('shows why adopting failed, and lets it be tried again', () => {
      show({path: '/dev/ttyACM0', state: 'failed', macAddress: '14:2B:2F:AF:8F:DC', error: 'no-wifi-settings'});
      expect(text()).toContain('kennt die Einstellungen ihres WLANs nicht');
      expect(button().textContent).toContain('Erneut versuchen');
    });

    it('has no button while it is busy', () => {
      show({path: '/dev/ttyACM0', state: 'identifying'}, {path: '/dev/ttyACM1', state: 'adopting', macAddress: 'AA:BB:CC:DD:EE:01'});
      expect(rows().length).toBe(2);
      expect(button()).toBeNull();
    });
  });

  describe('the color of the case', () => {
    const swatch = (name: string) => element().querySelector<HTMLButtonElement>(`.swatch[aria-label="${name}"]`);
    // opens the menu of the buzzer and returns its item for the color, which is in the overlay
    const menuItem = () => {
      element().querySelector<HTMLButtonElement>('.buzzer .more').click();
      fixture.detectChanges();
      return document.querySelector<HTMLButtonElement>('.mat-mdc-menu-panel button[mat-menu-item]');
    };

    it('is chosen when adopting a buzzer', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0'});
      swatch('Blau').click();
      fixture.detectChanges();
      expect(swatch('Blau').getAttribute('aria-checked')).toBe('true');
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', '#1e88e5');
    });

    it('is kept without a choice', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0'});
      expect(swatch('Keine').getAttribute('aria-checked')).toBe('true');
      // no check mark on "Keine", which keeps its own icon
      expect(swatch('Keine').textContent.trim()).toBe('block');
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', undefined);
    });

    it('of a buzzer set up before is taken as it is, also from another box', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0', color: '#fdd835',
        ssid: 'OtherBox'});
      expect(text()).toContain('Gelber Wireless Buzzer');
      expect(swatch('Gelb')).toBeNull();
      expect(element().querySelector('.buzzer .more')).not.toBeNull();
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', undefined);
    });

    it('of a buzzer without WiFi but with a color is taken as it is', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0', color: '#fdd835'});
      expect(swatch('Gelb')).toBeNull();
    });

    it('of an adopted buzzer can be changed through the menu', () => {
      show({path: '/dev/ttyACM0', state: 'adopted', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0', color: '#fdd835',
        ssid: 'BuzzerBoxNetwork', isAdopted: true});
      expect(button()).toBeNull();
      expect(swatch('Gelb')).toBeNull();
      menuItem().click();
      fixture.detectChanges();
      expect(swatch('Gelb').getAttribute('aria-checked')).toBe('true');
      swatch('Keine').click();
      fixture.detectChanges();
      expect(button().textContent).toContain('Farbe übernehmen');
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', '');
      fixture.detectChanges();
      expect(swatch('Gelb')).toBeNull();
    });

    it('can be left as it was through the menu', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0', color: '#fdd835',
        ssid: 'BuzzerBoxNetwork', isAdopted: true});
      menuItem().click();
      fixture.detectChanges();
      swatch('Blau').click();
      fixture.detectChanges();
      expect(button().textContent).toContain('Farbe übernehmen');
      menuItem().click();
      fixture.detectChanges();
      expect(swatch('Blau')).toBeNull();
      expect(button().textContent).toContain('Erneut übernehmen');
    });

    it('offers neither red nor green, and white and black as they are', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0'});
      expect(swatch('Rot')).toBeNull();
      expect(swatch('Grün')).toBeNull();
      swatch('Weiß').click();
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', '#ffffff');
      show({path: '/dev/ttyACM1', state: 'detected', macAddress: '14:2B:2F:AF:8F:DD', firmwareVersion: '1.2.0'});
      swatch('Schwarz').click();
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM1', '#000000');
    });

    it('needs a newer firmware', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.1.2'});
      expect(swatch('Blau')).toBeNull();
      expect(text()).toContain('Firmware 1.2.0 oder neuer');
      button().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', undefined);
    });

    it('names the buzzer as the server does among the others of its color', () => {
      online(udp('14:2B:2F:AF:8F:DC', {name: 'Gelber Wireless Buzzer (8F:DC)', color: '#fdd835', online: false}));
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2b:2f:af:8f:dc', firmwareVersion: '1.2.0', color: '#fdd835'});
      expect(text()).toContain('Gelber Wireless Buzzer (8F:DC)');
    });

    it('shows the color it was just given over USB before the heartbeats tell it', () => {
      online(udp('14:2B:2F:AF:8F:DC', {name: 'Funkbuzzer 8F:DC'}));
      show({path: '/dev/ttyACM0', state: 'adopted', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.3.0', color: '#1e88e5',
        ssid: 'BuzzerBoxNetwork', isAdopted: true, isConnected: true});
      expect(rows()[0].textContent).toContain('Blauer Wireless Buzzer');
    });
  });
});
