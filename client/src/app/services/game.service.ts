import {Injectable, OnDestroy} from '@angular/core';
import {WebSocketService} from './web-socket.service';
import {
  IAutosaveInfoPacket,
  IGameStorageRef,
  EAnswerStates,
  EMediaStates,
  EPacketTypes,
  EGradeResults,
  EQuestionAnswerStates,
  GameStateHelper,
  GameFormatHelper,
  ClassicRoundRules,
  RoundRulesHelper,
  IAnswer,
  IAnswerSetStatePacket,
  IDataForScreenPacket,
  IEndGamePacket,
  IGamePacket,
  IGameState,
  IGradeAnswerPacket,
  IInstallUpdatePacket,
  IKeypressOnScreenPacket,
  IMarkTeamPacket,
  IMediaQuestionState,
  IMediaVolume,
  INewMasterAccepted,
  IPresetupAvailableInfoPacket,
  IQuestion,
  IRound,
  IRoundProgress,
  IRegisterMasterPacket,
  IRegisterScreenPacket,
  IResetServerPacket,
  IResponsePacket,
  ISetBuzzerLockPacket,
  ISetMediaVolumePacket,
  ISetQuestionPacket,
  ISetRoundPacket,
  ISelectQuestionPacket,
  ISetPickingTeamPacket,
  IJeopardyRound,
  IJeopardyRoundProgress,
  IJeopardyTile,
  IFinalRound,
  IFinalRoundProgress,
  ISetWagerPacket,
  IPlayOptions,
  ISetupPacket,
  IStartGamePacket,
  IStorageAccessPacket,
  ITeam,
  ITeamSetPointsPacket,
  IUpdateInfoPacket,
  IUpdateMediaStatePacket,
  IUpdateTeamsPacket,
  IBuzzer,
  PacketHelper
} from '../../../../shared/shared';
import {BehaviorSubject, Observable, ReplaySubject, Subject, Subscription} from 'rxjs';
import {Router} from '@angular/router';
import {EGameStatesMaster} from '../master/enums/EGameStatesMaster';
import {Logger} from '../helper/logger';
import {baseUrlMaster, pathsMaster} from '../master/paths-master';
import {TeamHelper} from '../helper/team.helper';
import * as Uuid from 'uuid';
import {baseUrlScreen, pathsScreen} from '../screen/paths-screen';
import {ConfigService} from './config.service';

export type ZeroVoidCallback = () => void;

/**
 * Why the server does not let this device be the master, see EGameStatesMaster.REJECTED
 */
export interface IMasterRejection {
  // the other master is in a game, not just setting one up
  isGameRunning: boolean;
  // the other device took over from this one, which then doesn't try to get back in by itself
  takenOver: boolean;
}

// how long a refused master waits before it tries again, which lets it in once the other master is gone; the wait
// doubles with every refusal up to the maximum, so a device left on that page doesn't keep the box busy
const MASTER_RETRY_DELAY_MS = 3000;
const MASTER_RETRY_MAX_DELAY_MS = 15000;
// where the browser keeps the ID that tells the server it is the same device, see IRegisterMasterPacket.masterId
const MASTER_ID_STORAGE_KEY = 'buzzerbox-master-id';

@Injectable({
  providedIn: 'root'
})
export class GameService implements OnDestroy {
  // private webSocketService: WebSocketService;
  private webSocketListenSubscription: Promise<Subscription>;
  // private webSocketListenSubscription: Subscription;
  private currentGameStateInAutomaton: EGameStatesMaster;
  private previousGameStateInAutomaton: EGameStatesMaster;
  private teams: ITeam[];
  private rounds: IRound[];
  private currentGameState: IGameState;
  private presetupData: IPresetupAvailableInfoPacket;
  private initedAsMaster = false;
  private initedAsScreen = false;
  private screenId: string = null;
  private isScreenDataAvailable = false;
  // the master gets these too, when grading reveals the correct answers
  private answerSetStatePacketSubject = new Subject<IAnswerSetStatePacket>();
  private gradeAnswerSubject = new Subject<IGradeAnswerPacket>();
  private gradingRequestSubject = new Subject<void>();
  private cbUpdateCurrentQuestion: ZeroVoidCallback;
  private cbEndGame: ZeroVoidCallback;
  private markTeamSubject: Subject<IMarkTeamPacket>;
  private setBuzzerLockSubject: Subject<ISetBuzzerLockPacket>;
  private updateMediaStateSubject = new ReplaySubject<IUpdateMediaStatePacket>(1);
  private mediaVolumeSubject = new ReplaySubject<IMediaVolume>(1);
  private updateInfoSubject = new ReplaySubject<IUpdateInfoPacket>(1);
  private installUpdateResponseSubject = new Subject<IResponsePacket>();
  // the token for the storage API, which the server gives the master only
  private storageTokenSubject = new BehaviorSubject<string | null>(null);
  private autosaveInfoSubject = new ReplaySubject<IAutosaveInfoPacket>(1);
  private masterRejection: IMasterRejection | null = null;
  private masterRetryTimer: ReturnType<typeof setTimeout> | null = null;
  // refusals since the last time the user asked to try again, which the wait before the next try depends on
  private masterRetryCount = 0;
  // while the user decides whether to take over, see pauseMasterRetry()
  private masterRetryPaused = false;
  private readonly masterId = GameService.loadMasterId();
  // registering again after a reconnect has to take over as well, see registerMaster()
  private takeOverRequested = false;

  constructor(
    private webSocketService: WebSocketService,
    private router: Router,
    private config: ConfigService
  ) {
    this.webSocketListenSubscription = this.webSocketService.listen(this.onMessage.bind(this));
    this.webSocketService.observeReconnects().subscribe(() => this.onReconnected());
    this.markTeamSubject = new Subject<IMarkTeamPacket>();
    this.teams = [];
    this.rounds = [];
  }

  public useAsMaster(): void {
    if (!this.initedAsMaster && !this.initedAsScreen) {
      this.setNewGameState(EGameStatesMaster.STARTING);
      this.registerMaster();
      this.initedAsMaster = true;
    }
  }

  public useAsScreen(): void {
    if (!this.initedAsScreen && !this.initedAsMaster) {
      this.screenId = Uuid.v4();
      this.registerScreen();
      this.initedAsScreen = true;
    }
  }

  /**
   * Checks whether the data for a screen is completely available
   */
  public dataAvailable(): boolean {
    return this.isScreenDataAvailable;
  }

  /**
   * The server dropped this client with the lost connection, so it has to join again
   */
  private onReconnected(): void {
    if (this.isUsedAsScreen()) {
      // the game may have changed or even be gone meanwhile; a fresh start of the screen shows what is there now
      window.location.reload();
    } else if (this.initedAsMaster) {
      switch (this.currentGameStateInAutomaton) {
        case EGameStatesMaster.STARTING:
        case EGameStatesMaster.MASTER_ACCEPTED:
        case EGameStatesMaster.RECEIVED_PRESETUP_DATA:
          // no game was set up yet, so registering again keeps what was entered in the setup so far
          this.registerMaster();
          break;
        case EGameStatesMaster.REJECTED:
          // the server closes the connection of a refused master; trying again lets it in once the other master is gone
          this.scheduleMasterRetry();
          break;
        default:
          // the server keeps a running game for a master that rejoins, which a reload does
          window.location.reload();
          break;
      }
    }
  }

  private registerMaster(): void {
    // the box has no clock it can rely on, see ClockService
    this.webSocketService.send<IRegisterMasterPacket>({
      packetType: EPacketTypes.REGISTER_MASTER,
      clientTime: Date.now(),
      masterId: this.masterId,
      takeOver: this.takeOverRequested || undefined
    });
  }

  /**
   * The same in every tab and after a reload, as long as the browser keeps it
   */
  private static loadMasterId(): string {
    try {
      let id = localStorage.getItem(MASTER_ID_STORAGE_KEY);
      if (!id) {
        id = Uuid.v4();
        localStorage.setItem(MASTER_ID_STORAGE_KEY, id);
      }
      return id;
    } catch {
      // without storage, a reload counts as another device, which has to take over a running game
      return Uuid.v4();
    }
  }

  /**
   * For a refused master: tries to become the master again, or takes over from the master that is connected
   */
  public registerAgainAsMaster(takeOver = false): void {
    this.masterRetryCount = 0;
    this.tryAgainAsMaster(takeOver);
  }

  private tryAgainAsMaster(takeOver: boolean): void {
    if (this.currentGameStateInAutomaton !== EGameStatesMaster.REJECTED) {
      return;
    }
    this.clearMasterRetry();
    this.takeOverRequested = takeOver;
    this.setNewGameState(EGameStatesMaster.STARTING);
    this.registerMaster();
  }

  /**
   * Stops a refused master from trying again by itself while the user decides whether to take over; a retry would
   * leave the refused state in the meantime, and the takeover would then go nowhere
   */
  public pauseMasterRetry(paused: boolean): void {
    this.masterRetryPaused = paused;
    if (paused) {
      this.clearMasterRetry();
    } else {
      this.scheduleMasterRetry();
    }
  }

  private scheduleMasterRetry(): void {
    this.clearMasterRetry();
    if (this.currentGameStateInAutomaton !== EGameStatesMaster.REJECTED || this.masterRejection?.takenOver || this.masterRetryPaused) {
      return;
    }
    const delay = Math.min(MASTER_RETRY_DELAY_MS * 2 ** this.masterRetryCount, MASTER_RETRY_MAX_DELAY_MS);
    this.masterRetryCount++;
    this.masterRetryTimer = setTimeout(() => this.tryAgainAsMaster(false), delay);
  }

  private clearMasterRetry(): void {
    clearTimeout(this.masterRetryTimer);
    this.masterRetryTimer = null;
  }

  public getMasterRejection(): IMasterRejection | null {
    return this.masterRejection;
  }

  private onMessage(message: IGamePacket): void {
    Logger.log('Got new websocket message', message);
    if (message == null) {
      // ignore
      return;
    }
    switch (message.packetType) {
      case EPacketTypes.RESPONSE_PACKET:
        this.handleResponsePackets(message as IResponsePacket);
        break;
      case EPacketTypes.PRESETUP_AVAILABLE_INFO:
        this.handlePresetupAvailableInfo(message as IPresetupAvailableInfoPacket);
        break;
      case EPacketTypes.NEW_MASTER_ACCEPTED:
        this.handleNewMasterAcceptedPacket(message as INewMasterAccepted);
        break;
      case EPacketTypes.DATA_FOR_SCREEN:
        this.handleDataForScreenPacket(message as IDataForScreenPacket);
        break;
      case EPacketTypes.TEAM_SET_POINTS:
        this.handleTeamSetPointsPacket(message as ITeamSetPointsPacket);
        break;
      case EPacketTypes.ANSWER_SET_STATE:
        this.handleAnswerSetStatePacket(message as IAnswerSetStatePacket);
        break;
      case EPacketTypes.SET_QUESTION:
        this.handleSetQuestionPacket(message as ISetQuestionPacket);
        break;
      case EPacketTypes.SET_ROUND:
        this.handleSetRoundPacket(message as ISetRoundPacket);
        break;
      case EPacketTypes.END_GAME:
        this.handleEndGamePacket(message as IEndGamePacket);
        break;
      case EPacketTypes.MARK_TEAM:
        this.handleMarkTeamPacket(message as IMarkTeamPacket);
        break;
      case EPacketTypes.SET_BUZZER_LOCK:
        this.handleSetBuzzerLockPacket(message as ISetBuzzerLockPacket);
        break;
      case EPacketTypes.RESET_SERVER:
        this.handleResetServerPacket(message as IResetServerPacket);
        break;
      case EPacketTypes.UPDATE_MEDIA_STATE:
        this.handleMediaStateUpdate(message as IUpdateMediaStatePacket);
        break;
      case EPacketTypes.SET_MEDIA_VOLUME:
        this.handleMediaVolumePacket(message as ISetMediaVolumePacket);
        break;
      case EPacketTypes.GRADE_ANSWER:
        this.handleGradeAnswerPacket(message as IGradeAnswerPacket);
        break;
      case EPacketTypes.SELECT_QUESTION:
        this.handleSelectQuestionPacket(message as ISelectQuestionPacket);
        break;
      case EPacketTypes.SET_PICKING_TEAM:
        this.handleSetPickingTeamPacket(message as ISetPickingTeamPacket);
        break;
      case EPacketTypes.SET_WAGER:
        this.handleSetWagerPacket(message as ISetWagerPacket);
        break;
      case EPacketTypes.UPDATE_TEAMS:
        this.handleUpdateTeamsPacket(message as IUpdateTeamsPacket);
        break;
      case EPacketTypes.UPDATE_INFO:
        this.updateInfoSubject.next(message as IUpdateInfoPacket);
        break;
      case EPacketTypes.STORAGE_ACCESS:
        this.storageTokenSubject.next((message as IStorageAccessPacket).token);
        break;
      case EPacketTypes.AUTOSAVE_INFO:
        this.autosaveInfoSubject.next(message as IAutosaveInfoPacket);
        break;
      case EPacketTypes.MASTER_TAKEN_OVER:
        this.handleMasterTakenOver();
        break;
      default:
        break;
    }
  }

  async ngOnDestroy(): Promise<void> {
    this.clearMasterRetry();
    if (this.webSocketListenSubscription != null && (await this.webSocketListenSubscription) != null) {
     (await this.webSocketListenSubscription).unsubscribe();
    }
  }

  private handlePresetupAvailableInfo(packet: IPresetupAvailableInfoPacket): void {
    // only accept this packet when the master was just accepted, hence no game is really started yet
    if (this.currentGameStateInAutomaton === EGameStatesMaster.MASTER_ACCEPTED) {
      this.setNewGameState(EGameStatesMaster.RECEIVED_PRESETUP_DATA);
      this.presetupData = packet;
      // the game of before a reset or a takeover is over; the play page shows it until it is left
      this.redirect(baseUrlMaster + pathsMaster.home).then(() => this.clearGameData());
    } else if (this.currentGameStateInAutomaton === EGameStatesMaster.RECEIVED_PRESETUP_DATA) {
      // registered again after a lost connection; a restarted server has new buzzer IDs
      this.presetupData = packet;
    }
  }

  private setNewGameState(newState: EGameStatesMaster): void {
    Logger.log(`Setting new game state: ${EGameStatesMaster[newState]}`);
    this.previousGameStateInAutomaton = this.currentGameStateInAutomaton;
    this.currentGameStateInAutomaton = newState;
  }

  private handleResponsePackets(packet: IResponsePacket): void {
    if (packet.responseTo === EPacketTypes.REGISTER_MASTER && this.isRegisteringAsMaster()) {
      this.handleMasterRegistrationResponse(packet);
    } else if (packet.responseTo === EPacketTypes.SETUP_GAME && this.currentGameStateInAutomaton === EGameStatesMaster.RECEIVED_PRESETUP_DATA) {
      this.handleGameSetupResponse(packet);
    } else if (packet.responseTo === EPacketTypes.START_GAME && this.currentGameStateInAutomaton === EGameStatesMaster.READY_TO_START) {
      this.handleStartGameResponse(packet);
    } else if (packet.responseTo === EPacketTypes.INSTALL_UPDATE) {
      this.installUpdateResponseSubject.next(packet);
    }
  }

  private isRegisteringAsMaster(): boolean {
    // after a lost connection, a master that is setting up registers again, see onReconnected()
    return [EGameStatesMaster.STARTING, EGameStatesMaster.MASTER_ACCEPTED, EGameStatesMaster.RECEIVED_PRESETUP_DATA]
      .includes(this.currentGameStateInAutomaton);
  }

  private handleMasterRegistrationResponse(packet: IResponsePacket): void {
    this.takeOverRequested = false;
    if (packet.wasSuccessful) {
      this.masterRejection = null;
      this.masterRetryCount = 0;
      if (this.currentGameStateInAutomaton === EGameStatesMaster.STARTING) {
        this.setNewGameState(EGameStatesMaster.MASTER_ACCEPTED);
      }
    } else {
      this.masterRejection = {isGameRunning: !!packet.isGameRunning, takenOver: false};
      this.setNewGameState(EGameStatesMaster.REJECTED);
      this.redirect(baseUrlMaster + pathsMaster.masterAlreadyRegistered);
    }
  }

  private handleMasterTakenOver(): void {
    if (!this.initedAsMaster) {
      return;
    }
    this.masterRejection = {isGameRunning: this.isInGame(), takenOver: true};
    // the server revoked the token, and no longer saves for this device; the game data stays until the page is left
    this.storageTokenSubject.next(null);
    this.autosaveInfoSubject.next({packetType: EPacketTypes.AUTOSAVE_INFO, storage: null});
    this.setNewGameState(EGameStatesMaster.REJECTED);
    this.redirect(baseUrlMaster + pathsMaster.masterAlreadyRegistered);
  }

  /**
   * Like the server's isGameRunning(): a game is set up and not over yet
   */
  private isInGame(): boolean {
    return [EGameStatesMaster.READY_TO_START, EGameStatesMaster.PLAYING].includes(this.currentGameStateInAutomaton);
  }

  public getGameState(): EGameStatesMaster {
    return this.currentGameStateInAutomaton;
  }

  private redirect(target: string): Promise<boolean> {
    return this.router.navigate([target]);
  }

  public getPresetupData(): IPresetupAvailableInfoPacket {
    return this.presetupData;
  }

  /**
   * Sets up a stored game, whose state the server then saves while it is played
   * @param rounds with the URLs of their media
   * @param gameState undefined for a new state
   * @param themeId how the screens look, see screen-themes.ts
   * @param playOptions how this play goes, see IGameState.playOptions
   */
  public setupStoredGame(teams: ITeam[], rounds: IRound[], gameState: IGameState | undefined, storage: IGameStorageRef,
                         isNewState: boolean, themeId?: string, playOptions?: IPlayOptions): Promise<void> {
    return this.setupGame(teams, rounds, gameState, true, storage, isNewState, themeId, playOptions);
  }

  public setupGame(teams: ITeam[], rounds: IRound[], currentGameState?: IGameState, sendPacket: boolean = true,
                   storage?: IGameStorageRef, isNewState?: boolean, themeId?: string, playOptions?: IPlayOptions): Promise<void> {
    const promise: Promise<void> = this.setGameData(teams, rounds, currentGameState, true);
    // the master shows parts of the theme too, e.g. the answers' letters
    if (themeId) {
      this.currentGameState.themeId = themeId;
    }
    if (playOptions) {
      this.currentGameState.playOptions = playOptions;
    }
    // console.log("current 2", currentGameState);
    // if (currentGameState == null) {
    //   throw new Error("grrrr");
    // }
    if (sendPacket) {
      this.webSocketService.send<ISetupPacket>({
        packetType: EPacketTypes.SETUP_GAME,
        teams,
        rounds,
        currentGameState,
        storage,
        isNewState,
        themeId,
        playOptions
      });
    }
    return promise;
  }

  private handleGameSetupResponse(packet: IResponsePacket): void {
    if (packet.wasSuccessful) {
      // the screens already show the first question, so the game starts right away
      this.setNewGameState(EGameStatesMaster.READY_TO_START);
      this.startGame();
    } else {
      // TODO: what to do if game setup was not successful?
      this.teams = null;
      this.rounds = null;
      this.currentGameState = null;
    }
  }

  private clearGameData(): void {
    this.teams = [];
    this.rounds = [];
    this.currentGameState = null;
  }

  private handleNewMasterAcceptedPacket(packet: INewMasterAccepted): void {
    if (this.currentGameStateInAutomaton === EGameStatesMaster.STARTING) {
      // the server answers a takeover of a running game with this packet instead of a response
      this.takeOverRequested = false;
      this.masterRejection = null;
      this.masterRetryCount = 0;
      if (packet.availableBuzzers) {
        // needed to change the teams later on
        this.presetupData = {packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO, availableBuzzers: packet.availableBuzzers};
      }
      this.setGameData(packet.teams, packet.rounds, packet.currentGameState);
      // the screens still show the running game, so it goes on right away
      this.setNewGameState(EGameStatesMaster.READY_TO_START);
      this.startGame();
    }
  }

  private handleStartGameResponse(packet: IResponsePacket): void {
    if (packet.wasSuccessful) {
      this.setNewGameState(EGameStatesMaster.PLAYING);
      this.redirect(baseUrlMaster + pathsMaster.play);
    }
  }

  public startGame(): void {
    this.webSocketService.send<IStartGamePacket>({
      packetType: EPacketTypes.START_GAME
    });
  }

  public getTeams(): ITeam[] {
    return this.teams;
  }

  /**
   * The questions of the current round
   */
  public getQuestions(): IQuestion[] {
    const round = this.getCurrentRound();
    return round ? RoundRulesHelper.get(round).getQuestions(round) : [];
  }

  public getRounds(): IRound[] {
    return this.rounds;
  }

  public getCurrentRound(): IRound | undefined {
    return GameFormatHelper.getCurrentRound(this.rounds, this.currentGameState);
  }

  /**
   * The state a game starts with
   */
  public static makeInitialGameState(): IGameState {
    return {
      currentRoundId: '',
      roundProgress: {},
      loggedAnswers: [],
      activatedAnswers: [],
      markedTeamIds: [],
      // if no gameState was passed, we can probably assume that the lock is not set since the game might be just starting
      setBuzzerLock: false,
      mediaQuestionState: {
        mediaState: EMediaStates.NO_MEDIA,
        questionState: EQuestionAnswerStates.SHOWN,
        answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA
      },
      mediaVolume: PacketHelper.getDefaultMediaVolume()
    };
  }

  public async setGameData(teams: ITeam[], rounds: IRound[], gameState?: IGameState, dotNotMergeBuzzerIds: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!dotNotMergeBuzzerIds) {
        this.teams = this.mergeBuzzerIdsFromPresetupDataWithSetTeams(teams);
      } else {
        this.teams = teams;
      }
      for (const team of this.teams) {
        if (team.points == null) {
          team.points = 0;
        }
      }
      this.rounds = rounds ?? [];
      if (gameState == null) {
        this.currentGameState = GameFormatHelper.completeGameState(GameService.makeInitialGameState(), this.rounds);
      } else {
        // the server sends complete states; one passed in from a file may not be
        this.currentGameState = GameFormatHelper.completeGameState(gameState, this.rounds);
      }
      resolve();
    });
  }

  public getCurrentQuestion(): IQuestion {
    if (!this.currentGameState) { return null; }
    return GameFormatHelper.getCurrentQuestion(this.rounds, this.currentGameState) ?? null;
  }

  /**
   * The place of the current question in its round, counted from 0
   */
  public getCurrentQuestionNumber(): number {
    const round = this.getCurrentRound();
    return round ? RoundRulesHelper.get(round).getCurrentQuestionIndex(round, this.getCurrentProgress()) : 0;
  }

  private getCurrentProgress(): IRoundProgress | undefined {
    return GameFormatHelper.getCurrentProgress(this.currentGameState);
  }

  public addPoint(team: ITeam): void {
    this.addPoints(team, 1);
  }

  public addPoints(team: ITeam, points: number): void {
    team.points += points;
    this.sendSetTeamsSetPointsPacket(team);
  }

  public static getQuestionPoints(question: IQuestion | null | undefined): number {
    return ClassicRoundRules.getQuestionPoints(question);
  }

  /**
   * Point values are only worth showing when they differ, i.e. some question is not worth the default 1 point
   */
  public hasCustomQuestionPoints(): boolean {
    return GameFormatHelper.getAllQuestions(this.rounds).some(question => GameService.getQuestionPoints(question) !== 1);
  }

  public removePoint(team: ITeam): void {
    team.points -= 1;
    this.sendSetTeamsSetPointsPacket(team);
  }

  private sendSetTeamsSetPointsPacket(team: ITeam): void {
    this.webSocketService.send<ITeamSetPointsPacket>({
      packetType: EPacketTypes.TEAM_SET_POINTS,
      points: team.points,
      teamId: team.teamId
    });
  }

  /**
   * Puts the teams of a saved state on the buzzers that are available now, since buzzer IDs are new on every server
   * start. Teams whose buzzer no longer exists are dropped, and so are their marks.
   */
  public mapTeamsToBuzzers(teams: ITeam[], gameState?: IGameState): {teams: ITeam[], gameState?: IGameState} {
    const copies = (teams ?? []).map(team => ({...team}));
    const savedTeamIds = new Map<ITeam, string>(copies.map(team => [team, team.teamId]));
    const mappedTeams = this.setCurrentBuzzerIdsToTeams(copies);
    if (gameState?.markedTeamIds == null) {
      return {teams: mappedTeams, gameState};
    }
    const newTeamIds = new Map<string, string>();
    mappedTeams.forEach(team => newTeamIds.set(savedTeamIds.get(team), team.teamId));
    return {
      teams: mappedTeams,
      gameState: {
        ...gameState,
        markedTeamIds: gameState.markedTeamIds.filter(id => newTeamIds.has(id)).map(id => newTeamIds.get(id))
      }
    };
  }

  public getGameName(): string {
    return ConfigService.get().gameName + ' ' + ConfigService.get().masterName;
  }

  /**
   * This one is just to mark an answer as given, without revealing if it is true
   */
  public logInAnswer(answer: IAnswer): void {
    this.sendAnswerSetStatePacket(PacketHelper.makeAnswerSetSatePacket(EAnswerStates.LOG_IN, answer));
  }

  /**
   * This one activates a given answer, revealing if it was true
   */
  public activateAnswer(answer: IAnswer): void {
    this.sendAnswerSetStatePacket(PacketHelper.makeAnswerSetSatePacket(EAnswerStates.ACTIVATE, answer));
  }

  public logOutAnswer(answer: IAnswer): void {
    this.sendAnswerSetStatePacket(PacketHelper.makeAnswerSetSatePacket(EAnswerStates.LOG_OUT, answer));
  }

  private sendAnswerSetStatePacket(packet: IAnswerSetStatePacket): void {
    // the server does not send these back to the master, so keep track of them here
    GameStateHelper.applyAnswerState(this.currentGameState, packet);
    this.webSocketService.send<IAnswerSetStatePacket>(packet);
  }

  public getPreviousQuestion(): IQuestion {
    if (this.hasPreviousQuestion()) {
      this.selectQuestion(this.getCurrentQuestionNumber() - 1);
    }
    return this.getCurrentQuestion();
  }

  public getNextQuestion(): IQuestion {
    if (this.hasNextQuestion()) {
      this.selectQuestion(this.getCurrentQuestionNumber() + 1);
    }
    return this.getCurrentQuestion();
  }

  private selectQuestion(index: number): void {
    if (!this.applySelectQuestion(index)) {
      return;
    }
    this.sendUnmarkAllTeamsPacket();
    this.webSocketService.send<ISetQuestionPacket>(PacketHelper.makeSetQuestionPacket(index));
  }

  /**
   * Shows the question at that place in the current round, as the server does for a SET_QUESTION packet
   */
  private applySelectQuestion(index: number): boolean {
    const round = this.getCurrentRound();
    const progress = round ? RoundRulesHelper.get(round).selectQuestion(round, this.getCurrentProgress(), index) : null;
    if (progress == null) {
      return false;
    }
    this.currentGameState.roundProgress[round.id] = progress;
    GameStateHelper.resetQuestionProgress(this.currentGameState);
    return true;
  }

  public hasPreviousQuestion(): boolean {
    const round = this.getCurrentRound();
    return !!round && RoundRulesHelper.get(round).hasPreviousQuestion(round, this.getCurrentProgress());
  }

  public hasNextQuestion(): boolean {
    const round = this.getCurrentRound();
    return !!round && RoundRulesHelper.get(round).hasNextQuestion(round, this.getCurrentProgress());
  }

  /**
   * Whether the round is done by its rules, see IRoundRules.isOver; the final once every team is graded
   */
  public isCurrentRoundOver(): boolean {
    const round = this.getCurrentRound();
    if (!round) {
      return false;
    }
    if (round.mode === 'final') {
      return (this.teams ?? []).every(team => this.getFinalGradeResult(team.teamId) != null);
    }
    return RoundRulesHelper.get(round).isOver(round, this.getCurrentProgress());
  }

  /**
   * The round after the current one, also before the current one is over; undefined after the last round
   */
  public getFollowingRound(): IRound | undefined {
    const round = this.getCurrentRound();
    return round ? this.rounds[GameFormatHelper.getRoundIndex(this.rounds, round.id) + 1] : undefined;
  }

  /**
   * Goes on with the round after the current one, see getFollowingRound()
   */
  public startNextRound(): IQuestion {
    const nextRound = this.getFollowingRound();
    if (nextRound) {
      this.applySetRound(nextRound.id);
      this.sendUnmarkAllTeamsPacket();
      this.webSocketService.send<ISetRoundPacket>(PacketHelper.makeSetRoundPacket(nextRound.id));
    }
    return this.getCurrentQuestion();
  }

  private applySetRound(roundId: string): void {
    this.currentGameState.currentRoundId = roundId;
    GameStateHelper.resetQuestionProgress(this.currentGameState);
  }

  /**
   * The Jeopardy round that is played, undefined in other rounds
   */
  public getCurrentJeopardyRound(): IJeopardyRound | undefined {
    const round = this.getCurrentRound();
    return round?.mode === 'jeopardy' ? round : undefined;
  }

  public getCurrentJeopardyProgress(): IJeopardyRoundProgress | undefined {
    return this.getCurrentJeopardyRound() ? this.getCurrentProgress() as IJeopardyRoundProgress : undefined;
  }

  /**
   * Whether the Jeopardy board is shown rather than a question
   */
  public isBoardShown(): boolean {
    return this.getCurrentJeopardyRound() != null && this.getCurrentJeopardyProgress()?.openQuestionId == null;
  }

  /**
   * The open tile of the Jeopardy board, undefined while the board is shown
   */
  public getOpenTile(): IJeopardyTile | undefined {
    const round = this.getCurrentJeopardyRound();
    return round ? RoundRulesHelper.jeopardy.getTile(round, this.getCurrentJeopardyProgress()?.openQuestionId) : undefined;
  }

  /**
   * Whether the team answered the open tile wrong and can't buzz on it again, see IPlayOptions.oneTryPerTile
   */
  public isLockedOut(teamId: string): boolean {
    return this.currentGameState?.playOptions?.oneTryPerTile !== false && this.getOpenTile() != null
      && RoundRulesHelper.jeopardy.isLockedOut(this.getCurrentJeopardyProgress(), teamId);
  }

  public isQuestionPlayed(questionId: string): boolean {
    return RoundRulesHelper.jeopardy.isPlayed(this.getCurrentJeopardyProgress(), questionId);
  }

  /**
   * Opens a tile of the board
   */
  public openTile(questionId: string): IQuestion {
    this.sendSelectQuestionPacket(PacketHelper.makeSelectQuestionPacket(questionId));
    return this.getCurrentQuestion();
  }

  /**
   * Goes back to the board
   * @param markPlayed closes the tile for good, e.g. as no team knew the answer
   */
  public closeTile(markPlayed: boolean): void {
    this.sendSelectQuestionPacket(PacketHelper.makeSelectQuestionPacket(null, markPlayed));
  }

  private sendSelectQuestionPacket(packet: ISelectQuestionPacket): void {
    if (this.applySelectQuestionPacket(packet)) {
      this.sendUnmarkAllTeamsPacket();
      this.webSocketService.send<ISelectQuestionPacket>(packet);
    }
  }

  private applySelectQuestionPacket(packet: ISelectQuestionPacket): boolean {
    const round = this.getCurrentRound();
    let progress: IJeopardyRoundProgress | IFinalRoundProgress | null = null;
    if (round?.mode === 'jeopardy') {
      progress = RoundRulesHelper.jeopardy.applySelectQuestion(round, this.getCurrentJeopardyProgress(), packet);
    } else if (round?.mode === 'final') {
      progress = RoundRulesHelper.final.applySelectQuestion(round, this.getCurrentFinalProgress(), packet);
    }
    if (progress == null) {
      return false;
    }
    this.currentGameState.roundProgress[round.id] = progress;
    GameStateHelper.resetQuestionProgress(this.currentGameState);
    return true;
  }

  private handleSelectQuestionPacket(packet: ISelectQuestionPacket): void {
    if (this.isUsedAsScreen() && this.applySelectQuestionPacket(packet) && this.cbUpdateCurrentQuestion != null) {
      this.cbUpdateCurrentQuestion();
    }
  }

  // ---- wagers: Daily Doubles and the final ----

  /**
   * The final that is played, undefined in other rounds
   */
  public getCurrentFinalRound(): IFinalRound | undefined {
    const round = this.getCurrentRound();
    return round?.mode === 'final' ? round : undefined;
  }

  public getCurrentFinalProgress(): IFinalRoundProgress | undefined {
    return this.getCurrentFinalRound() ? this.getCurrentProgress() as IFinalRoundProgress : undefined;
  }

  /**
   * Whether the open tile of the board is a Daily Double
   */
  public isOpenTileDailyDouble(): boolean {
    const round = this.getCurrentJeopardyRound();
    return !!round && RoundRulesHelper.jeopardy.isDailyDouble(round, this.getCurrentJeopardyProgress()?.openQuestionId);
  }

  /**
   * Whether teams wager now instead of a question being shown: on a Daily Double until the team that picked it wagered,
   * in the final until the master shows the question
   */
  public isWagerStage(): boolean {
    if (this.getCurrentFinalRound()) {
      return !this.getCurrentFinalProgress()?.questionShown;
    }
    const tile = this.getOpenTile();
    const progress = this.getCurrentJeopardyProgress();
    return !!tile && this.isOpenTileDailyDouble() && !this.isQuestionPlayed(tile.question.id)
      && (progress?.pickingTeamId == null || progress.wagers?.[progress.pickingTeamId] == null);
  }

  /**
   * The teams that wager now: the one that picked the Daily Double, or every team in the final
   */
  public getWageringTeams(): ITeam[] {
    if (this.getCurrentFinalRound()) {
      return this.teams ?? [];
    }
    const pickingTeam = this.isOpenTileDailyDouble() ? this.getPickingTeam() : undefined;
    return pickingTeam ? [pickingTeam] : [];
  }

  public getWager(teamId: string): number | undefined {
    const progress = this.getCurrentFinalProgress() ?? this.getCurrentJeopardyProgress();
    return progress?.wagers?.[teamId];
  }

  public getMaxWager(team: ITeam): number {
    const final = this.getCurrentFinalRound();
    if (final) {
      return RoundRulesHelper.final.getMaxWager(team.points ?? 0);
    }
    const round = this.getCurrentJeopardyRound();
    return round ? RoundRulesHelper.jeopardy.getMaxWager(round, team.points ?? 0) : 0;
  }

  /**
   * The server keeps it within getMaxWager and sends back what it took
   */
  public setWager(teamId: string, wager: number): void {
    this.webSocketService.send<ISetWagerPacket>(PacketHelper.makeSetWagerPacket(teamId, wager));
  }

  private handleSetWagerPacket(packet: ISetWagerPacket): void {
    const round = this.getCurrentRound();
    const progress = this.getCurrentProgress() as IJeopardyRoundProgress | IFinalRoundProgress;
    if (round && progress && (round.mode === 'jeopardy' || round.mode === 'final')) {
      this.currentGameState.roundProgress[round.id] = {...progress, wagers: {...progress.wagers, [packet.teamId]: packet.wager}};
    }
  }

  /**
   * Shows the question of the final, once every team wagered
   */
  public showFinalQuestion(): IQuestion {
    const final = this.getCurrentFinalRound();
    if (final) {
      this.sendSelectQuestionPacket(PacketHelper.makeSelectQuestionPacket(final.question.id));
    }
    return this.getCurrentQuestion();
  }

  public haveAllTeamsWagered(): boolean {
    return this.getWageringTeams().every(team => this.getWager(team.teamId) != null);
  }

  /**
   * The teams the master grades by hand, for their wagers: the one that picked the Daily Double once it wagered, or
   * every team once the question of the final is shown
   */
  public getTeamsGradedByWager(): ITeam[] {
    if (this.getCurrentFinalRound()) {
      return this.getCurrentFinalProgress()?.questionShown ? (this.teams ?? []) : [];
    }
    return this.isOpenTileDailyDouble() && !this.isWagerStage() ? this.getWageringTeams() : [];
  }

  public mayGrade(teamId: string): boolean {
    const round = this.getCurrentRound();
    return !!round && RoundRulesHelper.get(round).mayGrade(round, this.getCurrentProgress(), teamId, this.currentGameState?.playOptions ?? {});
  }

  /**
   * How the master graded the team in the final, undefined if not yet
   */
  public getFinalGradeResult(teamId: string): EGradeResults | undefined {
    return this.getCurrentFinalProgress()?.gradeResults?.[teamId];
  }

  /**
   * Grades a team that wagered: it wins or loses its wager
   */
  public gradeWager(teamId: string, isCorrect: boolean): void {
    this.gradeAnswer(teamId, isCorrect ? EGradeResults.CORRECT : EGradeResults.WRONG, false);
  }

  /**
   * The team that picks the next tile of the board, undefined if none is chosen
   */
  public getPickingTeam(): ITeam | undefined {
    const teamId = this.getCurrentJeopardyProgress()?.pickingTeamId;
    return teamId ? this.findTeam(teamId) : undefined;
  }

  public setPickingTeam(teamId: string | null): void {
    this.applySetPickingTeam(teamId);
    this.webSocketService.send<ISetPickingTeamPacket>(PacketHelper.makeSetPickingTeamPacket(teamId));
  }

  private applySetPickingTeam(teamId: string | null): void {
    const round = this.getCurrentJeopardyRound();
    if (round) {
      this.currentGameState.roundProgress[round.id] = RoundRulesHelper.jeopardy.applySetPickingTeam(this.getCurrentJeopardyProgress(), teamId);
    }
  }

  private handleSetPickingTeamPacket(packet: ISetPickingTeamPacket): void {
    if (this.isUsedAsScreen()) {
      this.applySetPickingTeam(packet.teamId);
    }
  }

  /**
   * The server, the master and the screens all go on the same way after a grade, see IRoundRules.afterGrade
   */
  private handleGradeAnswerPacket(packet: IGradeAnswerPacket): void {
    const round = this.getCurrentRound();
    if (round && this.currentGameState) {
      this.currentGameState.roundProgress[round.id] = RoundRulesHelper.get(round).afterGrade(round, this.getCurrentProgress(), packet.teamId, packet.result);
    }
    this.gradeAnswerSubject.next(packet);
  }

  /**
   * What a correct answer to the current question is worth: its points, or the value of the open tile
   */
  public getCurrentQuestionValue(): number {
    const round = this.getCurrentRound();
    const teamId = this.getCurrentJeopardyProgress()?.pickingTeamId ?? '';
    return round ? Math.abs(RoundRulesHelper.get(round).getGradePoints(round, this.getCurrentProgress(), EGradeResults.CORRECT, teamId)) : 1;
  }

  /**
   * The header of the current question, e.g. "Frage 3/10", or "Geografie · 300" for a tile of the board
   */
  public getQuestionTitle(): string {
    const final = this.getCurrentFinalRound();
    if (final) {
      return final.category;
    }
    const tile = this.getOpenTile();
    if (tile) {
      return `${tile.category.name} · ${this.isOpenTileDailyDouble() ? 'Daily Double' : tile.value}`;
    }
    return `Frage ${this.getCurrentQuestionNumber() + 1}/${this.getQuestions().length}`;
  }

  public endGame(): void {
    this.setNewGameState(EGameStatesMaster.END);
    this.webSocketService.send<IEndGamePacket>(PacketHelper.makeEndGamePacket());
  }

  /**
   * This will make a copy and does not alter the original teams' array
   */
  public getTeamsOrderedByScore(): ITeam[] {
    const clonedTeamsArray: ITeam[] = TeamHelper.cloneTeams(this.teams);
    return clonedTeamsArray.sort((a, b) => {
      let ret = 0;
      if (a.points > b.points) {
        ret = -1;
      } else if (a.points < b.points) {
        ret = 1;
      }
      return ret;
    });
  }

  private registerScreen(): void {
    this.webSocketService.send<IRegisterScreenPacket>({
      packetType: EPacketTypes.REGISTER_SCREEN,
      screenId: this.screenId
    });
  }

  private handleDataForScreenPacket(packet: IDataForScreenPacket): void {
    if (this.isUsedAsScreen()) {
      this.setGameData(packet.teams, packet.rounds, packet.gameState);
      if (packet.gameState?.mediaQuestionState) {
        this.updateMediaStateSubject.next({
          packetType: EPacketTypes.UPDATE_MEDIA_STATE,
          mediaQuestionState: packet.gameState.mediaQuestionState
        });
      }
      this.mediaVolumeSubject.next(packet.gameState?.mediaVolume ?? PacketHelper.getDefaultMediaVolume());
      this.isScreenDataAvailable = true;
      this.redirect(baseUrlScreen + pathsScreen.main);
    }
  }

  /**
   * Ends the game; the server then sends the presetup data again, which takes the master to the start page
   */
  public resetServer(): void {
    this.setNewGameState(EGameStatesMaster.MASTER_ACCEPTED);
    // the game data stays until the presetup data takes the master to the start page, since the play page is shown until then
    this.webSocketService.send<IResetServerPacket>({
      packetType: EPacketTypes.RESET_SERVER
    });
  }

  private isUsedAsScreen(): boolean {
    return this.initedAsScreen && !this.initedAsMaster;
  }

  /**
   * Screens get every change of points; the master only those the server makes itself, when grading an answer
   */
  private handleTeamSetPointsPacket(packet: ITeamSetPointsPacket): void {
    const team: ITeam = this.findTeam(packet.teamId);
    if (team != null) {
      team.points = packet.points;
    }
  }

  public findTeam(teamId: string): ITeam {
    for (const team of this.teams) {
      if (teamId === team.teamId) {
        return team;
      }
    }
  }

  /**
   * Screens get every change of the answers; the master only the correct answers that grading reveals
   */
  private handleAnswerSetStatePacket(packet: IAnswerSetStatePacket): void {
    GameStateHelper.applyAnswerState(this.currentGameState, packet);
    this.answerSetStatePacketSubject.next(packet);
  }

  /**
   * The buzzers of the BuzzerBox, which teams can be put on
   */
  public getAvailableBuzzers(): IBuzzer[] {
    return this.presetupData?.availableBuzzers ?? [];
  }

  /**
   * Replaces the teams of the running game, see IUpdateTeamsPacket; the server sends back the teams it took
   */
  public updateTeams(teams: ITeam[]): void {
    this.webSocketService.send<IUpdateTeamsPacket>({packetType: EPacketTypes.UPDATE_TEAMS, teams});
  }

  private handleUpdateTeamsPacket(packet: IUpdateTeamsPacket): void {
    this.teams = packet.teams;
    for (const team of this.teams) {
      team.points ??= 0;
    }
    if (this.currentGameState?.markedTeamIds) {
      this.currentGameState.markedTeamIds = this.currentGameState.markedTeamIds.filter(id => this.findTeam(id) != null);
    }
  }

  /**
   * Grades the answer of the team that buzzed; the server awards the points, see IGradeAnswerPacket
   */
  public gradeAnswer(teamId: string, result: EGradeResults, revealCorrectAnswers: boolean, answer?: IAnswer): void {
    this.webSocketService.send<IGradeAnswerPacket>(PacketHelper.makeGradeAnswerPacket(teamId, result, revealCorrectAnswers, answer));
  }

  /**
   * Opens the grade dialog again after the master closed it without grading, see QuestionPaneComponent
   */
  public requestGrading(): void {
    this.gradingRequestSubject.next();
  }

  public observeGradingRequests(): Observable<void> {
    return this.gradingRequestSubject.asObservable();
  }

  public observeGradeAnswerPackets(): Observable<IGradeAnswerPacket> {
    return this.gradeAnswerSubject.asObservable();
  }

  private handleSetQuestionPacket(packet: ISetQuestionPacket): void {
    if (this.isUsedAsScreen()) {
      this.applySelectQuestion(packet.set);
      if (this.cbUpdateCurrentQuestion != null) {
        this.cbUpdateCurrentQuestion();
      }
    }
  }

  private handleSetRoundPacket(packet: ISetRoundPacket): void {
    if (this.isUsedAsScreen() && GameFormatHelper.getRound(this.rounds, packet.roundId) != null) {
      this.applySetRound(packet.roundId);
      if (this.cbUpdateCurrentQuestion != null) {
        this.cbUpdateCurrentQuestion();
      }
    }
  }

  public observeAnswerSetStatePacket(): Observable<IAnswerSetStatePacket> {
    return this.answerSetStatePacketSubject.asObservable();
  }

  public setCallbackUpdateCurrentQuestion(cb: ZeroVoidCallback): void {
    this.cbUpdateCurrentQuestion = cb;
  }

  private handleEndGamePacket(packet: IEndGamePacket): void {
    if (this.isUsedAsScreen() && this.cbEndGame != null) {
      this.cbEndGame();
    }
  }

  public setCallbackEndGame(cb: ZeroVoidCallback): void {
    this.cbEndGame = cb;
  }

  public sendKeypress(keyCode: string): void {
    this.webSocketService.send<IKeypressOnScreenPacket>(PacketHelper.makeKeypressOnScreenPacket(keyCode));
  }

  private mergeBuzzerIdsFromPresetupDataWithSetTeams(teams: ITeam[]): ITeam[] {
    if (this.presetupData != null) {
    const availableBuzzers = this.presetupData.availableBuzzers;
    for (let i = 0; i < teams.length; i++) {
      // teams without a buzzerIndex sit on the buzzers in order
      const buzzer = availableBuzzers[teams[i].buzzerIndex ?? i];
      if (buzzer != null) {
        teams[i].buzzerId = buzzer.id;
        teams[i].teamId = buzzer.id;
      }
      }
    }
    return teams;
  }

  private handleMarkTeamPacket(packet: IMarkTeamPacket): void {
    if (this.currentGameState != null) {
      GameStateHelper.applyMarkTeam(this.currentGameState, packet);
    }
    this.markTeamSubject.next(packet);
  }

  public observeMarkTeamPackets(): Observable<IMarkTeamPacket> {
    return this.markTeamSubject.asObservable();
  }

  public setMarkTeam(teamId: string, marked: boolean = true): void {
    this.webSocketService.send<IMarkTeamPacket>(PacketHelper.makeMarkTeamPacket(teamId, marked));
  }

  public sendUnmarkAllTeamsPacket(): void {
    this.webSocketService.send<IMarkTeamPacket>({
      packetType: EPacketTypes.MARK_TEAM,
      teamId: null,
      mark: null,
      unmarkAll: true
    });
  }

  public observeBuzzerLockPackets(): Observable<ISetBuzzerLockPacket> {
    if (this.setBuzzerLockSubject == null) {
      this.setBuzzerLockSubject = new Subject<ISetBuzzerLockPacket>();
    }
    return this.setBuzzerLockSubject.asObservable();
  }

  private handleSetBuzzerLockPacket(packet: ISetBuzzerLockPacket): void {
    if (this.currentGameState != null) {
      this.currentGameState.setBuzzerLock = packet.setLock;
    }
    if (this.setBuzzerLockSubject != null) {
      this.setBuzzerLockSubject.next(packet);
    }
  }

  public setBuzzerLock(setState: boolean): void {
    this.currentGameState.setBuzzerLock = setState;
    const buzzerLockPacket = PacketHelper.makeBuzzerLockPacket(setState);
    this.webSocketService.send<ISetBuzzerLockPacket>(buzzerLockPacket);
  }

  public observeIsWebsocketConnected(): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      this.webSocketListenSubscription.then(_ => subscriber.next(true));
    });
  }

  /**
   * Puts the teams of a savegame on the buzzers that are available now. Teams whose buzzer no longer exists are dropped.
   */
  private setCurrentBuzzerIdsToTeams(teams: ITeam[]): ITeam[] {
    const availableBuzzers = this.presetupData.availableBuzzers;
    const ret: ITeam[] = [];
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      // savegames from before buzzerIndex existed have their teams on the buzzers in order
      const buzzerIndex = team.buzzerIndex ?? i;
      if (buzzerIndex >= availableBuzzers.length) {
        continue;
      }
      team.buzzerIndex = buzzerIndex;
      team.teamId = availableBuzzers[buzzerIndex].id;
      team.buzzerId = availableBuzzers[buzzerIndex].id;
      ret.push(team);
    }
    return ret;
  }

  private handleResetServerPacket(packet: IResetServerPacket): void {
    window.location.reload();
  }

  public releaseBuzzerLock(): void {
    this.webSocketService.send<ISetBuzzerLockPacket>(PacketHelper.makeBuzzerLockPacket(false));
  }

  /**
   * The installed version and the update bundles on the USB sticks, which the server sends to the master
   */
  public observeUpdateInfo(): Observable<IUpdateInfoPacket> {
    return this.updateInfoSubject.asObservable();
  }

  public observeInstallUpdateResponses(): Observable<IResponsePacket> {
    return this.installUpdateResponseSubject.asObservable();
  }

  /**
   * @param allowUnsigned install the bundle even without a valid signature, after the user was warned
   */
  public installUpdate(fileName: string, allowUnsigned = false): void {
    this.webSocketService.send<IInstallUpdatePacket>({packetType: EPacketTypes.INSTALL_UPDATE, fileName, allowUnsigned});
  }

  /**
   * How saving the running game goes, which the server reports
   */
  public observeAutosaveInfo(): Observable<IAutosaveInfoPacket> {
    return this.autosaveInfoSubject.asObservable();
  }

  /**
   * The token for the storage API, or null until the server accepted this device as the master
   */
  public getStorageToken(): string | null {
    return this.storageTokenSubject.getValue();
  }

  public getGameStateData(): IGameState {
    return this.currentGameState;
  }
  public observeMediaStateUpdates(): Observable<IUpdateMediaStatePacket> {
    return this.updateMediaStateSubject.asObservable();
  }

  /**
   * Changes the given parts of the current media question state and sends it to the server; the rest stays as it is.
   */
  public changeMediaState(changes: Partial<IMediaQuestionState>): void {
    const current = this.getCurrentMediaQuestionState();
    const mediaQuestionState: IMediaQuestionState = {...current, ...changes};
    // RESET restarts the media once; it must not be sent again with unrelated changes
    if (changes.mediaState === undefined && current.mediaState === EMediaStates.RESET) {
      mediaQuestionState.mediaState = EMediaStates.PLAYING;
    }
    this.currentGameState.mediaQuestionState = mediaQuestionState;
    const mediaPacket = PacketHelper.makeMediaStatePacketFromQuestionState(mediaQuestionState);
    this.webSocketService.send<IUpdateMediaStatePacket>(mediaPacket);
  }

  /**
   * Marks the media as played to the end: a question and answers waiting for the media are shown.
   */
  public finishMedia(changes: Partial<IMediaQuestionState> = {}): void {
    const current = this.getCurrentMediaQuestionState();
    const reveal = (state: EQuestionAnswerStates) => state === EQuestionAnswerStates.WAIT_FOR_MEDIA ? EQuestionAnswerStates.SHOWN : state;
    this.changeMediaState({
      mediaState: EMediaStates.FINISHED,
      questionState: reveal(current.questionState),
      answerState: reveal(current.answerState),
      ...changes
    });
  }

  public observeMediaVolume(): Observable<IMediaVolume> {
    return this.mediaVolumeSubject.asObservable();
  }

  public getCurrentMediaVolume(): IMediaVolume {
    return this.currentGameState?.mediaVolume ?? PacketHelper.getDefaultMediaVolume();
  }

  public setMediaVolume(mediaVolume: IMediaVolume): void {
    this.currentGameState.mediaVolume = mediaVolume;
    this.webSocketService.send<ISetMediaVolumePacket>(PacketHelper.makeMediaVolumePacket(mediaVolume));
  }

  private handleMediaVolumePacket(packet: ISetMediaVolumePacket): void {
    if (this.currentGameState != null) {
      this.currentGameState.mediaVolume = packet.mediaVolume;
    }
    this.mediaVolumeSubject.next(packet.mediaVolume);
  }

  public getCurrentMediaQuestionState(): IMediaQuestionState {
    return this.currentGameState?.mediaQuestionState ?? PacketHelper.getDefaultMediaState();
  }

  private handleMediaStateUpdate(packet: IUpdateMediaStatePacket): void {
    this.currentGameState.mediaQuestionState = packet.mediaQuestionState;
    this.updateMediaStateSubject.next(packet);
  }
}
