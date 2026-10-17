import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScoreBoardComponent } from './score-board.component';
import {ITeam} from '../../../../../../shared/shared';

describe('ScoreBoardComponent', () => {
  let component: ScoreBoardComponent;
  let fixture: ComponentFixture<ScoreBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScoreBoardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScoreBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  const team = (teamId: string, points: number): ITeam => ({teamId, name: teamId, buzzerId: teamId, points});

  it('gives teams with the same points the same place', () => {
    const sorted = [team('A', 5), team('B', 3), team('C', 3), team('D', 1)];
    expect(ScoreBoardComponent.rank(sorted, sorted).map(entry => entry.place)).toEqual([1, 2, 2, 4]);
  });

  it('puts the winner in the middle of the podium', () => {
    const sorted = [team('A', 5), team('B', 3), team('C', 1)];
    const podium = ScoreBoardComponent.arrangePodium(ScoreBoardComponent.rank(sorted, sorted));
    expect(podium.map(entry => [entry.team.teamId, entry.order])).toEqual([['A', 2], ['B', 1], ['C', 3]]);
  });
});
