import { ComponentFixture, TestBed } from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import { BuzzerLockComponent } from './buzzer-lock.component';
import {GameService} from '../../../services/game.service';
import {IGameState, ITeam} from '../../../../../../shared/shared';

describe('BuzzerLockComponent', () => {
  let fixture: ComponentFixture<BuzzerLockComponent>;
  let gameState: Partial<IGameState>;
  let game: {getGameStateData: () => Partial<IGameState>, findTeam: (id: string) => Partial<ITeam>, releaseBuzzerLock: jasmine.Spy};

  beforeEach(async () => {
    gameState = {setBuzzerLock: false, markedTeamIds: []};
    game = {
      getGameStateData: () => gameState,
      findTeam: (id: string) => ({teamId: id, name: 'Team ' + id}),
      releaseBuzzerLock: jasmine.createSpy('releaseBuzzerLock')
    };
    await TestBed.configureTestingModule({
      declarations: [ BuzzerLockComponent ],
      imports: [MatButtonModule, MatIconModule],
      providers: [{provide: GameService, useValue: game}]
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

  it('releases the buzzers', () => {
    gameState = {setBuzzerLock: true, markedTeamIds: ['C']};
    button().click();
    expect(game.releaseBuzzerLock).toHaveBeenCalled();
  });
});
