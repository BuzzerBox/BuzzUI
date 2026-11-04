import { ComponentFixture, TestBed } from '@angular/core/testing';
import {provideZoneChangeDetection} from '@angular/core';
import {Subject} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {RouterModule} from '@angular/router';

import { TeamComponent } from './team.component';
import {TeamCardComponent} from '../../shared/play-ui/team-card/team-card.component';
import {GameService, IScreenTeam} from '../../services/game.service';
import {EPacketTypes, IGameState, IMarkTeamPacket, ITeam} from '../../../../../shared/shared';

describe('TeamComponent', () => {
  let fixture: ComponentFixture<TeamComponent>;
  let teams: ITeam[];
  let gameState: Partial<IGameState>;
  let screenTeam: IScreenTeam | null;
  let markTeam: Subject<IMarkTeamPacket>;

  beforeEach(async () => {
    teams = [
      {teamId: 'A', name: 'Team A', buzzerId: 'A', buzzerIndex: 0, points: 3},
      {teamId: 'B', name: 'Team B', buzzerId: 'B', buzzerIndex: 1, points: 7}
    ];
    gameState = {markedTeamIds: [], themeId: 'classic'};
    screenTeam = null;
    markTeam = new Subject();
    const game = {
      getTeams: () => teams,
      getGameStateData: () => gameState,
      getCurrentQuestion: () => null,
      getScreenTeam: () => screenTeam,
      useAsTeamScreen: (team: IScreenTeam | null) => screenTeam = team,
      observeMarkTeamPackets: () => markTeam.asObservable(),
      observeGradeAnswerPackets: () => new Subject().asObservable()
    };
    await TestBed.configureTestingModule({
      declarations: [ TeamComponent, TeamCardComponent ],
      imports: [MatButtonModule, MatCardModule, MatIconModule, RouterModule.forRoot([])],
      // like the app (main.ts)
      providers: [provideZoneChangeDetection(), {provide: GameService, useValue: game}]
    })
    .compileComponents();
    fixture = TestBed.createComponent(TeamComponent);
  });

  afterEach(() => document.documentElement.removeAttribute('data-screen-theme'));

  const card = (): HTMLElement => fixture.nativeElement.querySelector('.team-card');
  const teamButtons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button.team'));

  it('lets the user choose a team, then shows only its name and points', () => {
    fixture.detectChanges();
    expect(card()).toBeNull();
    expect(teamButtons().map(button => button.textContent.trim())).toEqual(['Team A', 'Team B']);

    teamButtons()[1].click();
    fixture.detectChanges();
    expect(screenTeam).toEqual({teamId: 'B', name: 'Team B'});
    expect(card().textContent).toContain('Team B');
    expect(card().textContent).toContain('7');
    expect(card().textContent).not.toContain('Team A');
  });

  it('lights up while its team holds the buzzer lock', () => {
    screenTeam = {teamId: 'A', name: 'Team A'};
    fixture.detectChanges();
    expect(card().classList).not.toContain('marked');

    markTeam.next({packetType: EPacketTypes.MARK_TEAM, teamId: 'A', mark: true});
    fixture.detectChanges();
    expect(card().classList).toContain('marked');

    markTeam.next({packetType: EPacketTypes.MARK_TEAM, teamId: null, mark: null, unmarkAll: true});
    fixture.detectChanges();
    expect(card().classList).not.toContain('marked');
  });

  it('finds its team by name after a restart of the server gave the buzzers new IDs', () => {
    screenTeam = {teamId: 'old-id', name: 'Team B'};
    fixture.detectChanges();
    expect(card().textContent).toContain('Team B');
    expect(screenTeam).toEqual({teamId: 'B', name: 'Team B'});
  });

  it('asks again for a team that isn\'t in the game anymore', () => {
    screenTeam = {teamId: 'C', name: 'Team C'};
    fixture.detectChanges();
    expect(card()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('„Team C“ spielt nicht mehr mit');
    expect(teamButtons().length).toBe(2);
  });

  it('goes back to the choice of the team', () => {
    screenTeam = {teamId: 'A', name: 'Team A'};
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.change-team') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(card()).toBeNull();
    expect(teamButtons().length).toBe(2);
  });
});
