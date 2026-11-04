import { ComponentFixture, TestBed } from '@angular/core/testing';
import {provideZoneChangeDetection} from '@angular/core';
import {Subject} from 'rxjs';

import { ChooseComponent } from './choose.component';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {RouterModule} from '@angular/router';
import {GameService} from '../services/game.service';
import {EPacketTypes, IGameInfoPacket} from '../../../../shared/shared';

describe('ChooseComponent', () => {
  let component: ChooseComponent;
  let fixture: ComponentFixture<ChooseComponent>;
  let gameInfo: Subject<IGameInfoPacket>;
  let requestGameInfo: jasmine.Spy;

  beforeEach(async () => {
    gameInfo = new Subject();
    requestGameInfo = jasmine.createSpy('requestGameInfo');
    await TestBed.configureTestingModule({
      declarations: [ ChooseComponent ],
      imports: [ MatButtonModule, MatIconModule, RouterModule.forRoot([]) ],
      // like the app (main.ts)
      providers: [provideZoneChangeDetection(), {provide: GameService, useValue: {requestGameInfo, observeGameInfo: () => gameInfo.asObservable()}}]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChooseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  const teamScreenLink = (): HTMLElement => fixture.nativeElement.querySelector('a[href="/screen/team"]');

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers the points screen of a team only while a game runs', () => {
    expect(requestGameInfo).toHaveBeenCalled();
    expect(teamScreenLink()).toBeNull();

    gameInfo.next({packetType: EPacketTypes.GAME_INFO, isGameRunning: true});
    fixture.detectChanges();
    expect(teamScreenLink()).not.toBeNull();

    gameInfo.next({packetType: EPacketTypes.GAME_INFO, isGameRunning: false});
    fixture.detectChanges();
    expect(teamScreenLink()).toBeNull();
  });
});
