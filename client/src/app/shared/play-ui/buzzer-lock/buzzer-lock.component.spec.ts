import { ComponentFixture, TestBed } from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatDialog} from '@angular/material/dialog';
import {Subject} from 'rxjs';

import { BuzzerLockComponent } from './buzzer-lock.component';
import {GameService} from '../../../services/game.service';
import {IGameState, ITeam} from '../../../../../../shared/shared';

describe('BuzzerLockComponent', () => {
  let fixture: ComponentFixture<BuzzerLockComponent>;
  let gameState: Partial<IGameState>;
  let game: {getGameStateData: () => Partial<IGameState>, findTeam: (id: string) => Partial<ITeam>, releaseBuzzerLock: jasmine.Spy};
  let dialog: {open: jasmine.Spy};
  // what the confirmation closes with
  let confirmation: Subject<boolean>;

  beforeEach(async () => {
    gameState = {setBuzzerLock: false, markedTeamIds: []};
    game = {
      getGameStateData: () => gameState,
      findTeam: (id: string) => ({teamId: id, name: 'Team ' + id}),
      releaseBuzzerLock: jasmine.createSpy('releaseBuzzerLock')
    };
    confirmation = new Subject();
    dialog = {open: jasmine.createSpy('open').and.callFake(() => ({afterClosed: () => confirmation.asObservable()}))};
    await TestBed.configureTestingModule({
      declarations: [ BuzzerLockComponent ],
      imports: [MatButtonModule, MatIconModule],
      providers: [{provide: GameService, useValue: game}, {provide: MatDialog, useValue: dialog}]
    })
    .compileComponents();
    fixture = TestBed.createComponent(BuzzerLockComponent);
  });

  const button = (): HTMLButtonElement => {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('button');
  };

  it('stays in the background while the buzzers are free', () => {
    expect(button().classList).not.toContain('locked');
    expect(button().textContent).toContain('Buzzer frei');
  });

  it('stands out and names the team that buzzed while the buzzers are locked', () => {
    gameState = {setBuzzerLock: true, markedTeamIds: ['C']};
    expect(button().classList).toContain('locked');
    expect(button().textContent).toContain('Buzzer freigeben');
    expect(button().textContent).toContain('Team C hat gebuzzert');
  });

  it('releases the buzzers once confirmed', () => {
    gameState = {setBuzzerLock: true, markedTeamIds: ['C']};
    button().click();
    expect(dialog.open.calls.mostRecent().args[1].data.message).toContain('Team C');
    expect(game.releaseBuzzerLock).not.toHaveBeenCalled();
    confirmation.next(true);
    expect(game.releaseBuzzerLock).toHaveBeenCalled();
  });

  it('keeps the buzzers locked when the confirmation is cancelled', () => {
    gameState = {setBuzzerLock: true, markedTeamIds: ['C']};
    button().click();
    confirmation.next(false);
    expect(game.releaseBuzzerLock).not.toHaveBeenCalled();
  });

  it('doesn\'t release another team that buzzed while the confirmation was open', () => {
    gameState = {setBuzzerLock: true, markedTeamIds: ['C']};
    button().click();
    gameState = {setBuzzerLock: true, markedTeamIds: ['D']};
    confirmation.next(true);
    expect(game.releaseBuzzerLock).not.toHaveBeenCalled();
  });

  it('releases free buzzers again without asking', () => {
    button().click();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(game.releaseBuzzerLock).toHaveBeenCalled();
  });
});
