import {Injectable, OnDestroy} from '@angular/core';
import {WebSocketService} from './web-socket.service';
import {
  EAnswerStates,
  EPacketTypes,
  IAnswer,
  IAnswerSetStatePacket,
  IDataForScreenPacket,
  IEndGamePacket,
  IGamePacket,
  IGameState,
  INewMasterAccepted,
  IPresetupAvailableInfoPacket,
  IQuestion,
  IRegisterMasterPacket,
  IRegisterScreenPacket,
  IResetServerPacket,
  IResponsePacket,
  ISetQuestionPacket,
  ISetupPacket,
  IStartGamePacket,
  ITeam,
  ITeamSetPointsPacket,
  IKeypressOnScreenPacket,
  IMarkTeamPacket,
  CURRENT_SAVEGAME_VERSION,
  ISetBuzzerLockPacket,
  PacketHelper
} from '../../../../shared/shared';
import {Observable, Subject, Subscription} from 'rxjs';
import {Router} from '@angular/router';
import {EGameStatesMaster} from '../master/enums/EGameStatesMaster';
import {Logger} from '../helper/logger';
import {pathsMaster} from '../master/paths-master';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import config from '../../../../config.json';
import {TeamHelper} from '../helper/team.helper';
import * as Uuid from 'uuid';
import {baseUrlScreen, pathsScreen} from '../screen/paths-screen';

export interface IGameStateAsJson {
  /**
   * Can be used to determine what data is actually stored in this and how to extract it
   */
  version: number;
  teams: ITeam[];
  question: IQuestion[];
  gameState: IGameState;
}

export type ZeroVoidCallback = () => void;

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
  private questions: IQuestion[];
  private currentGameState: IGameState;
  private presetupData: IPresetupAvailableInfoPacket;
  private joinedRunningGame: boolean;
  private initedAsMaster = false;
  private initedAsScreen = false;
  private screenId: string = null;
  private isScreenDataAvailable = false;
  private answerSetStatePacketSubject: Subject<IAnswerSetStatePacket>;
  private cbUpdateCurrentQuestion: ZeroVoidCallback;
  private cbEndGame: ZeroVoidCallback;
  private markTeamSubject: Subject<IMarkTeamPacket>;
  private setBuzzerLockSubject: Subject<ISetBuzzerLockPacket>;


  constructor(private webSocketService: WebSocketService, private router: Router, private sanitizer: DomSanitizer) {
    this.webSocketListenSubscription = this.webSocketService.listen(this.onMessage.bind(this));
    this.markTeamSubject = new Subject<IMarkTeamPacket>();
    this.teams = [];
  }

  public useAsMaster(): void {
    if (!this.initedAsMaster && !this.initedAsScreen) {
      this.joinedRunningGame = false;
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
      this.answerSetStatePacketSubject = new Subject<IAnswerSetStatePacket>();
    }
  }

  /**
   * Checks whether the data for a screen is completely available
   */
  public dataAvailable(): boolean {
    return this.isScreenDataAvailable;
  }

  private registerMaster(): void {
    this.webSocketService.send<IRegisterMasterPacket>({packetType: EPacketTypes.REGISTER_MASTER});
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
      default:
        break;
    }
  }

  async ngOnDestroy(): Promise<void> {
    if (this.webSocketListenSubscription != null && (await this.webSocketListenSubscription) != null) {
     (await this.webSocketListenSubscription).unsubscribe();
    }
  }

  private handlePresetupAvailableInfo(packet: IPresetupAvailableInfoPacket): void {
    // only accept this packet when the master was just accepted, hence no game is really started yet
    if (this.currentGameStateInAutomaton === EGameStatesMaster.MASTER_ACCEPTED) {
      this.setNewGameState(EGameStatesMaster.RECEIVED_PRESETUP_DATA);
      this.presetupData = packet;
      this.redirect(pathsMaster.setup);
    }
  }

  private setNewGameState(newState: EGameStatesMaster): void {
    Logger.log(`Setting new game state: ${EGameStatesMaster[newState]}`);
    this.previousGameStateInAutomaton = this.currentGameStateInAutomaton;
    this.currentGameStateInAutomaton = newState;
  }

  private handleResponsePackets(packet: IResponsePacket): void {
    if (packet.responseTo === EPacketTypes.REGISTER_MASTER && this.currentGameStateInAutomaton === EGameStatesMaster.STARTING) {
      this.handleMasterRegistrationResponse(packet);
    } else if (packet.responseTo === EPacketTypes.SETUP_GAME && this.currentGameStateInAutomaton === EGameStatesMaster.RECEIVED_PRESETUP_DATA) {
      this.handleGameSetupResponse(packet);
    } else if (packet.responseTo === EPacketTypes.START_GAME && this.currentGameStateInAutomaton === EGameStatesMaster.READY_TO_START) {
      this.handleStartGameResponse(packet);
    }
  }

  private handleMasterRegistrationResponse(packet): void {
    if (packet.wasSuccessful) {
      this.setNewGameState(EGameStatesMaster.MASTER_ACCEPTED);
    } else {
      this.setNewGameState(EGameStatesMaster.END);
      this.redirect(pathsMaster.masterAlreadyRegistered);
    }
  }

  public getGameState(): EGameStatesMaster {
    return this.currentGameStateInAutomaton;
  }

  private redirect(target: string): void {
    this.router.navigate([target]);
  }

  public getPresetupData(): IPresetupAvailableInfoPacket {
    return this.presetupData;
  }

  public setupGame(teams: ITeam[], questions: IQuestion[], currentGameState?: IGameState, sendPacket: boolean = true): void {
    this.setGameData(teams, questions, currentGameState, true);
    if (sendPacket) {
      this.webSocketService.send<ISetupPacket>({
        packetType: EPacketTypes.SETUP_GAME,
        teams,
        questions,
        currentGameState
      });
    }
  }

  private handleGameSetupResponse(packet: IResponsePacket): void {
    if (packet.wasSuccessful) {
      this.setNewGameState(EGameStatesMaster.READY_TO_START);
      this.redirect(pathsMaster.readyToStart);
    } else {
      // TODO: what to do if game setup was not successful?
      this.teams = null;
      this.questions = null;
      this.currentGameState = null;
    }
  }

  private handleNewMasterAcceptedPacket(packet: INewMasterAccepted): void {
    if (this.currentGameStateInAutomaton === EGameStatesMaster.STARTING) {
      this.joinedRunningGame = true;
      this.setGameData(packet.teams, packet.questions, packet.currentGameState);
      this.setNewGameState(EGameStatesMaster.READY_TO_START);
      this.redirect(pathsMaster.readyToStart);
    }
  }

  private handleStartGameResponse(packet: IResponsePacket): void {
    if (packet.wasSuccessful) {
      this.setNewGameState(EGameStatesMaster.PLAYING);
      this.redirect(pathsMaster.play);
    }
  }

  public startGame(): void {
    this.webSocketService.send<IStartGamePacket>({
      packetType: EPacketTypes.START_GAME
    });
  }

  public didJoinRunningGame(): boolean {
    return this.joinedRunningGame;
  }

  public getTeams(): ITeam[] {
    return this.teams;
  }

  public getQuestions(): IQuestion[] {
    return this.questions;
  }

  public async setGameData(teams: ITeam[], questions: IQuestion[], gameState?: IGameState, dotNotMergeBuzzerIds: boolean = false): Promise<void> {
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
      this.questions = questions;
      if (gameState == null) {
        this.currentGameState = {
          currentQuestionNumber: 0,
          loggedAnswers: [],
          markedTeamIds: [],
          // if no gameState was passed, we can probably assume that the lock is not set since the game might be just starting
          setBuzzerLock: false
        };
      } else {
        this.currentGameState = gameState;
      }
    });
  }

  public getQuestion(i: number): IQuestion {
    return this.questions[i];
  }

  public getCurrentQuestion(): IQuestion {
    return this.getQuestion(this.currentGameState.currentQuestionNumber);
  }

  public getCurrentQuestionNumber(): number {
    return this.currentGameState.currentQuestionNumber;
  }

  public addPoint(team: ITeam): void {
    team.points += 1;
    this.sendSetTeamsSetPointsPacket(team);
  }

  public removePoint(team: ITeam): void {
    team.points -= 1;
    if (team.points < 0) {
      team.points = 0;
    }
    this.sendSetTeamsSetPointsPacket(team);
  }

  private sendSetTeamsSetPointsPacket(team: ITeam): void {
    this.webSocketService.send<ITeamSetPointsPacket>({
      packetType: EPacketTypes.TEAM_SET_POINTS,
      points: team.points,
      teamId: team.teamId
    });
  }

  public exportGameStateAsJson(): SafeUrl {
    const gameStateAsJson: IGameStateAsJson = {
      version: CURRENT_SAVEGAME_VERSION,
      teams: this.teams,
      question: this.questions,
      gameState: this.currentGameState
    };
    const json = JSON.stringify(gameStateAsJson);
    const blob = new Blob([json], {type: 'text/json'});
    const url = window.URL.createObjectURL(blob);
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  public importGameStateFromJson(gameState: IGameStateAsJson, sendPacketImmediately: boolean = true): void {
    if (gameState.version !== CURRENT_SAVEGAME_VERSION) {
      alert('savegame version is not okay');
      return;
    }
    this.currentGameState = gameState.gameState;
    gameState.teams = this.setCurrentBuzzerIdsToTeams(gameState.teams);
    this.setupGame(gameState.teams, gameState.question, gameState.gameState, sendPacketImmediately);
  }

  public getGameName(): string {
    return config.gameName + ' ' + config.masterName;
  }

  /**
   * This one is just to mark an answer as given, without revealing if it is true
   */
  public logInAnswer(answer: IAnswer): void {
    this.webSocketService.send<IAnswerSetStatePacket>(PacketHelper.makeAnswerSetSatePacket(EAnswerStates.LOG_IN, answer));
  }

  /**
   * This one activates a given answer, revealing if it was true
   */
  public activateAnswer(answer: IAnswer): void {
    this.webSocketService.send<IAnswerSetStatePacket>(PacketHelper.makeAnswerSetSatePacket(EAnswerStates.ACTIVATE, answer));
  }

  public logOutAnswer(answer: IAnswer): void {
    this.webSocketService.send<IAnswerSetStatePacket>(PacketHelper.makeAnswerSetSatePacket(EAnswerStates.LOG_OUT, answer));
  }

  public getPreviousQuestion(): IQuestion {
    if (this.hasPreviousQuestion()) {
      this.currentGameState.currentQuestionNumber--;
      this.sendUnmarkAllTeamsPacket();
      this.webSocketService.send<ISetQuestionPacket>(PacketHelper.makeSetQuestionPacket(this.getCurrentQuestionNumber()));
    }
    return this.getCurrentQuestion();
  }

  public getNextQuestion(): IQuestion {
    if (this.hasNextQuestion()) {
      this.currentGameState.currentQuestionNumber++;
      this.sendUnmarkAllTeamsPacket();
      this.webSocketService.send<ISetQuestionPacket>(PacketHelper.makeSetQuestionPacket(this.getCurrentQuestionNumber()));
    }
    return this.getCurrentQuestion();
  }

  public hasPreviousQuestion(): boolean {
    return this.getCurrentQuestionNumber() > 0;
  }

  public hasNextQuestion(): boolean {
    return this.getCurrentQuestionNumber() < this.questions.length - 1;
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
      this.setGameData(packet.teams, packet.questions, packet.gameState);
      this.isScreenDataAvailable = true;
      this.redirect(baseUrlScreen + pathsScreen.main);
    }
  }

  public resetServer(): void {
    this.webSocketService.send<IResetServerPacket>({
      packetType: EPacketTypes.RESET_SERVER
    });
    window.location.reload();
  }

  private isUsedAsScreen(): boolean {
    return this.initedAsScreen && !this.initedAsMaster;
  }

  private handleTeamSetPointsPacket(packet: ITeamSetPointsPacket): void {
    if (this.isUsedAsScreen()) {
      const team: ITeam = this.findTeam(packet.teamId);
      if (team != null) {
        team.points = packet.points;
      }
    }
  }

  private findTeam(teamId: string): ITeam {
    for (const team of this.teams) {
      if (teamId === team.teamId) {
        return team;
      }
    }
  }

  private handleAnswerSetStatePacket(packet: IAnswerSetStatePacket): void {
    if (this.isUsedAsScreen()) {
      this.answerSetStatePacketSubject.next(packet);
    }
  }

  private handleSetQuestionPacket(packet: ISetQuestionPacket): void {
    if (this.isUsedAsScreen()) {
      this.currentGameState.currentQuestionNumber = packet.set;
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
    for (let i = 0; i < availableBuzzers.length; i++) {
      const buzzerId: string = availableBuzzers[i].id;
      teams[i].buzzerId = buzzerId;
      teams[i].teamId = buzzerId;
      }
    }
    return teams;
  }

  private handleMarkTeamPacket(packet: IMarkTeamPacket): void {
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

  private setCurrentBuzzerIdsToTeams(teams: ITeam[]): ITeam[] {
    if (this.presetupData.availableBuzzers.length < teams.length) {
      throw new Error('Can\'t set buzzer IDs to teams since there are more teams than buzzers!');
    }

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      team.teamId = this.presetupData.availableBuzzers[i].id;
      team.buzzerId = this.presetupData.availableBuzzers[i].id;
    }

    return teams;
  }

  private handleResetServerPacket(packet: IResetServerPacket): void {
    window.location.reload();
  }
}
