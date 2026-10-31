import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {Component, provideZoneChangeDetection} from '@angular/core';
import {Subject} from 'rxjs';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';

import { TeamCardComponent } from './team-card.component';
import {GameService} from '../../../services/game.service';
import {EGradeResults, EPacketTypes, IGameState, IGradeAnswerPacket, IMarkTeamPacket, ITeam} from '../../../../../../shared/shared';

// like on the play page, so the card's own change detection runs as it does there
@Component({
  template: '<app-team-card [team]="team"></app-team-card><app-team-card [team]="other" class="other"></app-team-card>',
  standalone: false
})
class HostComponent {
  team: ITeam;
  other: ITeam;
}

describe('TeamCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let teams: ITeam[];
  let gameState: Partial<IGameState>;
  let markTeam: Subject<IMarkTeamPacket>;
  let gradeAnswer: Subject<IGradeAnswerPacket>;
  let lockedOutTeamIds: string[];

  beforeEach(async () => {
    teams = [
      {teamId: 'A', name: 'Team A', buzzerId: 'a', buzzerIndex: 0, points: 0},
      {teamId: 'B', name: 'Team B', buzzerId: 'b', buzzerIndex: 1, points: 0}
    ];
    gameState = {markedTeamIds: []};
    markTeam = new Subject();
    gradeAnswer = new Subject();
    lockedOutTeamIds = [];
    const game = {
      isLockedOut: (teamId: string) => lockedOutTeamIds.includes(teamId),
      getTeams: () => teams,
      getGameStateData: () => gameState,
      getCurrentQuestion: () => null,
      observeMarkTeamPackets: () => markTeam.asObservable(),
      observeGradeAnswerPackets: () => gradeAnswer.asObservable()
    };
    await TestBed.configureTestingModule({
      declarations: [ TeamCardComponent, HostComponent ],
      imports: [MatCardModule, MatIconModule],
      // like the app (main.ts), so the card's timers update it
      providers: [provideZoneChangeDetection(), {provide: GameService, useValue: game}]
    })
    .compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.team = teams[0];
    fixture.componentInstance.other = teams[1];
    fixture.detectChanges();
  });

  const card = (): HTMLElement => fixture.nativeElement.querySelector('.team-card');
  const otherCard = (): HTMLElement => fixture.nativeElement.querySelector('.other .team-card');
  const text = (): string => fixture.nativeElement.textContent;

  it('lights up when its team buzzed, and the other teams step back', () => {
    gameState.markedTeamIds = ['A'];
    markTeam.next({packetType: EPacketTypes.MARK_TEAM, teamId: 'A', mark: true} as IMarkTeamPacket);
    fixture.detectChanges();
    expect(card().classList).toContain('marked');
    expect(card().classList).not.toContain('dimmed');
    expect(otherCard().classList).toContain('dimmed');
  });

  it('shows that its team is out for the open tile', () => {
    lockedOutTeamIds = ['A'];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-team-card').classList).toContain('locked-out');
    expect(text()).toContain('gesperrt');
    expect(fixture.nativeElement.querySelector('.other').classList).not.toContain('locked-out');
  });

  it('counts up to new points and shows the change above them for a moment', fakeAsync(() => {
    teams[0].points = 3;
    fixture.detectChanges();
    expect(text()).toContain('+3');
    tick(700);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.points-value').textContent.trim()).toBe('3');
    tick(1000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.points-change')).toBeNull();
  }));

  it('shows a deduction with a minus sign', fakeAsync(() => {
    teams[0].points = -2;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.points-change.negative').textContent).toContain('−2');
    tick(2000);
  }));

  it('flashes after its answer was graded', fakeAsync(() => {
    gradeAnswer.next({packetType: EPacketTypes.GRADE_ANSWER, teamId: 'A', result: EGradeResults.WRONG} as IGradeAnswerPacket);
    fixture.detectChanges();
    expect(card().classList).toContain('grade-wrong');
    tick(2000);
    fixture.detectChanges();
    expect(card().classList).not.toContain('grade-wrong');
  }));

  it('shows the previous look in the classic theme: the new points right away, without effects', () => {
    gameState.themeId = 'classic';
    teams[0].points = 3;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.points-value').textContent.trim()).toBe('3');
    expect(fixture.nativeElement.querySelector('.points-change')).toBeNull();
    expect(fixture.nativeElement.querySelector('.crown')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-team-card').classList).not.toContain('show');
  });

  it('wears the crown only while its team leads', () => {
    expect(fixture.nativeElement.querySelector('.crown')).toBeNull();
    teams[0].points = 1;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.crown')).not.toBeNull();
  });
});
