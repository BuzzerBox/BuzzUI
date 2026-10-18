import {Subject} from 'rxjs';
import {IBuzzer, IGameInstanceState, IGameState, ITeam} from '../../../../../shared/shared';
import {PrepareGameComponent} from './prepare-game.component';

describe('PrepareGameComponent', () => {
  const box = (id: string): IBuzzer => ({id, name: id, keyBind: '', byteBind: '', type: 'serial'});
  const udp = (mac: string): IBuzzer => ({id: 'udp:' + mac, name: mac, keyBind: '', byteBind: '', type: 'udp', online: true});

  let buzzers: IBuzzer[];
  let buzzersSubject: Subject<IBuzzer[]>;
  let component: PrepareGameComponent;

  const create = (state: IGameInstanceState = null) => {
    buzzersSubject = new Subject<IBuzzer[]>();
    const game = {
      useAsMaster: () => undefined,
      getAvailableBuzzers: () => buzzers,
      observeAvailableBuzzers: () => buzzersSubject.asObservable(),
      // the teams' buzzers are found by ID here, which is enough for these tests
      mapTeamsToBuzzers: (teams: ITeam[], gameState?: IGameState) => ({
        teams: teams
          .map(team => ({...team, buzzerIndex: buzzers.findIndex(b => b.id === team.buzzerId)}))
          .filter(team => team.buzzerIndex >= 0),
        gameState
      })
    };
    component = new PrepareGameComponent(game as never, null, null, null);
    component.state = state;
    (component as unknown as {initTeams: () => void}).initTeams();
  };
  const changeBuzzers = (newBuzzers: IBuzzer[]) => {
    buzzers = newBuzzers;
    buzzersSubject.next(newBuzzers);
  };
  const rowIds = () => component.rows.map(row => row.buzzer.id);

  afterEach(() => component.ngOnDestroy());

  it('offers no choice without wireless buzzers and shows those of the box', () => {
    buzzers = [box('b0'), box('b1'), box('b2')];
    create();
    expect(component.canChooseBuzzerType()).toBeFalse();
    expect(rowIds()).toEqual(['b0', 'b1', 'b2']);
    expect(component.getActiveCount()).toBe(2);
  });

  it('shows the buzzers of one kind only and switches between them', () => {
    buzzers = [box('b0'), box('b1'), udp('01'), udp('02'), udp('03')];
    create();
    expect(component.canChooseBuzzerType()).toBeTrue();
    expect(rowIds()).toEqual(['b0', 'b1']);
    component.chooseBuzzerType('udp');
    expect(rowIds()).toEqual(['udp:01', 'udp:02', 'udp:03']);
    // the first two of them play, named in order, with their index among all buzzers
    expect(component.getActiveCount()).toBe(2);
    expect(component.rows.map(row => row.buzzerIndex)).toEqual([2, 3, 4]);
    expect(component.teamsFormGroup.get(component.rows[0].controlName).value).toBe('Team 1');
  });

  it('adds a wireless buzzer that turns up, keeping what was entered', () => {
    buzzers = [box('b0'), box('b1'), udp('01')];
    create();
    component.chooseBuzzerType('udp');
    component.teamsFormGroup.get(component.rows[0].controlName).setValue('Funk');
    changeBuzzers([...buzzers, udp('02')]);
    expect(rowIds()).toEqual(['udp:01', 'udp:02']);
    expect(component.teamsFormGroup.get(component.rows[0].controlName).value).toBe('Funk');
  });

  it('starts over when the buzzers came back in another order', () => {
    buzzers = [box('b0'), box('b1'), udp('01'), udp('02')];
    create();
    component.chooseBuzzerType('udp');
    component.teamsFormGroup.get(component.rows[0].controlName).setValue('Funk 01');
    // a restarted server found them the other way round
    changeBuzzers([box('n0'), box('n1'), udp('02'), udp('01')]);
    expect(rowIds()).toEqual(['udp:02', 'udp:01']);
    expect(component.teamsFormGroup.get(component.rows[0].controlName).value).toBe('Team 1');
  });

  it('continues a wireless game with the wireless buzzers, and warns when switching away', () => {
    buzzers = [box('b0'), box('b1'), udp('01'), udp('02')];
    const teams: ITeam[] = [
      {name: 'A', buzzerId: 'udp:01', teamId: 'udp:01', buzzerIndex: 2, points: 3},
      {name: 'B', buzzerId: 'udp:02', teamId: 'udp:02', buzzerIndex: 3, points: 1}
    ];
    create({teams} as IGameInstanceState);
    expect(component.buzzerType).toBe('udp');
    expect(component.getActiveCount()).toBe(2);
    expect(component.dropsSavedTeams()).toBeFalse();
    component.chooseBuzzerType('serial');
    expect(component.dropsSavedTeams()).toBeTrue();
    expect(component.getActiveCount()).toBe(0);
  });
});
