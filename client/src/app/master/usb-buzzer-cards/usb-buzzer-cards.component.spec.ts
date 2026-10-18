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

describe('UsbBuzzerCardsComponent', () => {
  let fixture: ComponentFixture<UsbBuzzerCardsComponent>;
  let buzzers: BehaviorSubject<IUsbBuzzer[]>;
  let game: jasmine.SpyObj<GameService>;

  beforeEach(async () => {
    buzzers = new BehaviorSubject<IUsbBuzzer[]>([]);
    game = jasmine.createSpyObj<GameService>('GameService', ['observeUsbBuzzers', 'adoptUsbBuzzer']);
    game.observeUsbBuzzers.and.returnValue(buzzers.asObservable());
    await TestBed.configureTestingModule({
      declarations: [UsbBuzzerCardsComponent],
      imports: [MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
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
    expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0');
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
    expect(game.adoptUsbBuzzer).toHaveBeenCalledWith('/dev/ttyACM0');
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
});
