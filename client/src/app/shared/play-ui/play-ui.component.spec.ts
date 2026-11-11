import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayUiComponent } from './play-ui.component';
import { GameService } from '../../services/game.service';
import { ITeam } from '../../../../../shared/shared';

describe('PlayUiComponent', () => {
  let component: PlayUiComponent;
  let fixture: ComponentFixture<PlayUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayUiComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// where the teams go: the screens split them between both sides, the master's one column lists them in that order
describe('PlayUiComponent team sides', () => {
  const makeTeams = (count: number): ITeam[] =>
    Array.from({length: count}, (_, i) => ({teamId: `t${i + 1}`, name: `Team ${i + 1}`}) as ITeam);

  function create(teams: ITeam[], isMaster: boolean): PlayUiComponent {
    const component = new PlayUiComponent({getTeams: () => teams} as unknown as GameService, null);
    component.isMaster = isMaster;
    return component;
  }

  const names = (teams: ITeam[]) => teams.map(team => team.name);

  it('puts every other team on the left of the screens, from the first', () => {
    const component = create(makeTeams(4), false);
    expect(component.hasOneTeamColumn()).toBeFalse();
    expect(names(component.getScreenLeftTeams())).toEqual(['Team 1', 'Team 3']);
    expect(names(component.getScreenRightTeams())).toEqual(['Team 2', 'Team 4']);
  });

  it('gives the master one column for up to 4 teams, with the same sides as the screens', () => {
    const component = create(makeTeams(3), true);
    expect(component.hasOneTeamColumn()).toBeTrue();
    expect(names(component.getScreenLeftTeams())).toEqual(['Team 1', 'Team 3']);
    expect(names(component.getScreenRightTeams())).toEqual(['Team 2']);
  });

  it('splits more than 4 teams between both sides on the master too', () => {
    expect(create(makeTeams(5), true).hasOneTeamColumn()).toBeFalse();
  });
});
