import { ComponentFixture, TestBed } from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {of} from 'rxjs';

import { MasterAlreadyRegisteredComponent } from './master-already-registered.component';
import {GameService, IMasterRejection} from '../../services/game.service';

describe('MasterAlreadyRegisteredComponent', () => {
  let component: MasterAlreadyRegisteredComponent;
  let fixture: ComponentFixture<MasterAlreadyRegisteredComponent>;
  let rejection: IMasterRejection;
  let game: jasmine.SpyObj<GameService>;
  let confirmed: boolean;

  beforeEach(async () => {
    rejection = {isGameRunning: true, takenOver: false};
    game = jasmine.createSpyObj<GameService>('GameService', ['getMasterRejection', 'registerAgainAsMaster']);
    game.getMasterRejection.and.callFake(() => rejection);
    await TestBed.configureTestingModule({
      declarations: [ MasterAlreadyRegisteredComponent ],
      providers: [
        {provide: GameService, useValue: game},
        {provide: MatDialog, useValue: {open: () => ({afterClosed: () => of(confirmed)})}}
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  const create = () => {
    fixture = TestBed.createComponent(MasterAlreadyRegisteredComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('says that another device is in a game', () => {
    create();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Ein anderes Gerät steuert gerade die BuzzerBox');
    expect(text).toContain('Dort läuft gerade ein Spiel.');
  });

  it('says when this device was taken over from', () => {
    rejection = {isGameRunning: true, takenOver: true};
    create();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Ein anderes Gerät hat die Steuerung übernommen');
    expect(text).toContain('Steuerung zurückholen');
    expect(text).not.toContain('Versucht es laufend erneut');
  });

  it('takes over only once confirmed', () => {
    create();
    confirmed = false;
    component.takeOver();
    expect(game.registerAgainAsMaster).not.toHaveBeenCalled();
    confirmed = true;
    component.takeOver();
    expect(game.registerAgainAsMaster).toHaveBeenCalledWith(true);
  });
});
