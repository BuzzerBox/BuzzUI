import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideZoneChangeDetection} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {IUsbBuzzer} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {UsbBuzzerCardsComponent} from './usb-buzzer-cards.component';
import {BuzzerColorComponent} from '../buzzer-color/buzzer-color.component';

describe('UsbBuzzerCardsComponent', () => {
  let fixture: ComponentFixture<UsbBuzzerCardsComponent>;
  let buzzers: BehaviorSubject<IUsbBuzzer[]>;
  let game: jasmine.SpyObj<GameService>;

  beforeEach(async () => {
    buzzers = new BehaviorSubject<IUsbBuzzer[]>([]);
    game = jasmine.createSpyObj<GameService>('GameService', ['observeUsbBuzzers', 'adoptUsbBuzzer', 'getAvailableBuzzers']);
    game.observeUsbBuzzers.and.returnValue(buzzers.asObservable());
    game.getAvailableBuzzers.and.returnValue([]);
    await TestBed.configureTestingModule({
      declarations: [UsbBuzzerCardsComponent],
      imports: [BuzzerColorComponent, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
      providers: [{provide: GameService, useValue: game}, provideZoneChangeDetection()]
    }).compileComponents();
    fixture = TestBed.createComponent(UsbBuzzerCardsComponent);
    fixture.detectChanges();
  });

  const show = (...list: IUsbBuzzer[]) => {
    buzzers.next(list);
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent;
  const button = () => (fixture.nativeElement as HTMLElement).querySelector('button');

  it('shows nothing without buzzers', () => {
    expect(fixture.nativeElement.querySelector('mat-card')).toBeNull();
  });

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
    expect(fixture.nativeElement.querySelectorAll('mat-card').length).toBe(2);
    expect(button()).toBeNull();
  });

  describe('the color of the case', () => {
    const action = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('mat-card-actions button');
    const swatch = (name: string) =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`.swatch[aria-label="${name}"]`);

    it('is chosen when adopting a buzzer', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0'});
      swatch('Blau').click();
      fixture.detectChanges();
      expect(swatch('Blau').getAttribute('aria-checked')).toBe('true');
      action().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', '#1e88e5');
    });

    it('is kept without a choice', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0', color: '#fdd835'});
      expect(text()).toContain('Gehäuse Gelb');
      expect(text()).toContain('Gelber Wireless Buzzer');
      expect(swatch('Gelb').getAttribute('aria-checked')).toBe('true');
      action().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', undefined);
    });

    it('of an adopted buzzer can be changed', () => {
      show({path: '/dev/ttyACM0', state: 'adopted', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.2.0', color: '#fdd835',
        ssid: 'BuzzerBoxNetwork', isAdopted: true});
      expect(action()).toBeNull();
      swatch('Keine').click();
      fixture.detectChanges();
      expect(action().textContent).toContain('Farbe übernehmen');
      action().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', '');
    });

    it('needs a newer firmware', () => {
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2B:2F:AF:8F:DC', firmwareVersion: '1.1.2'});
      expect(swatch('Blau')).toBeNull();
      expect(text()).toContain('Firmware 1.2.0 oder neuer');
      action().click();
      expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0', undefined);
    });

    it('names the buzzer as the server does among the others of its color', () => {
      game.getAvailableBuzzers.and.returnValue([{id: 'udp:14:2B:2F:AF:8F:DC', name: 'Gelber Wireless Buzzer (8F:DC)',
        keyBind: '', byteBind: '', type: 'udp', color: '#fdd835'}]);
      show({path: '/dev/ttyACM0', state: 'detected', macAddress: '14:2b:2f:af:8f:dc', firmwareVersion: '1.2.0', color: '#fdd835'});
      expect(text()).toContain('Gelber Wireless Buzzer (8F:DC)');
    });
  });
});
