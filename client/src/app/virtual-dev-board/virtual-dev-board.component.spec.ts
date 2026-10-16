import { ComponentFixture, TestBed } from '@angular/core/testing';
import {Subscription} from 'rxjs';

import { VirtualDevBoardComponent } from './virtual-dev-board.component';
import {GameService} from '../services/game.service';
import {WebSocketService} from '../services/web-socket.service';
import {ConfigService} from '../services/config.service';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {LoadingSpinnerComponent} from '../shared/loading-spinner/loading-spinner.component';

describe('VirtualDevBoardComponent', () => {
  let component: VirtualDevBoardComponent;
  let fixture: ComponentFixture<VirtualDevBoardComponent>;
  let game: jasmine.SpyObj<GameService>;

  beforeEach(async () => {
    game = jasmine.createSpyObj<GameService>('GameService', ['sendKeypress']);
    await TestBed.configureTestingModule({
      declarations: [ VirtualDevBoardComponent, LoadingSpinnerComponent ],
      imports: [ MatButtonToggleModule, MatProgressSpinnerModule ],
      providers: [
        { provide: GameService, useValue: game },
        { provide: WebSocketService, useValue: { listen: () => Promise.resolve(new Subscription()) } }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VirtualDevBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends the key bound to a buzzer and the soft release key', () => {
    component.sendBuzzerPress(0);
    component.sendReleaseLockButtonPress();
    expect(game.sendKeypress.calls.allArgs()).toEqual([
      [ConfigService.get().buzzers[0].key],
      [ConfigService.get().softReleaseKey]
    ]);
  });
});
