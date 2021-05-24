import {Injectable, OnDestroy, Sanitizer} from '@angular/core';
import {WebSocketService} from './web-socket.service';
import {
  EPacketTypes,
  IGamePacket,
  INewMasterAccepted,
  IPresetupAvailableInfoPacket,
  IQuestion,
  IRegisterMasterPacket,
  IResponsePacket,
  ISetupPacket,
  IStartGamePacket,
  ITeam,
  IGameState,
  ITeamSetPointsPacket
} from '../../../../shared/objects/shared';
import {Subscription} from 'rxjs';
import {Router} from '@angular/router';
import {EGameStatesMaster} from '../master/enums/EGameStatesMaster';
import {Logger} from '../helper/logger';
import {pathsMaster} from '../master/paths-master';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import config from '../../../../config.json';

export interface IGameStateAsJson {
  teams: ITeam[];
  question: IQuestion[];
  gameState: IGameState;
}

@Injectable({
  providedIn: 'root'
})
export class GameService implements OnDestroy {
  // private webSocketService: WebSocketService;
  private webSocketListenSubscription: Subscription;
  private currentGameStateInAutomaton: EGameStatesMaster;
  private previousGameStateInAutomaton: EGameStatesMaster;
  private teams: ITeam[];
  private questions: IQuestion[];
  private currentGameState: IGameState;
  private presetupData: IPresetupAvailableInfoPacket;
  private joinedRunningGame: boolean;

  constructor(private webSocketService: WebSocketService, private router: Router, private sanitizer: DomSanitizer) {
    this.joinedRunningGame = false;
    this.teams = [];
    this.setNewGameState(EGameStatesMaster.STARTING);
    this.webSocketListenSubscription = webSocketService.listen(this.onMessage.bind(this));
    this.registerMaster();
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
      default:
        break;
    }
  }

  ngOnDestroy(): void {
    if (this.webSocketListenSubscription != null) {
      this.webSocketListenSubscription.unsubscribe();
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

  public setupGame(teams: ITeam[], questions: IQuestion[], sendPacket: boolean = true): void {
    this.setGameData(teams, questions);
    if (sendPacket) {
      this.webSocketService.send<ISetupPacket>({
        packetType: EPacketTypes.SETUP_GAME,
        teams,
        questions
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
      if (packet.currentGameState == null) {
        this.joinedRunningGame = true;
        this.setGameData(packet.teams, packet.questions, packet.currentGameState);
        this.setNewGameState(EGameStatesMaster.READY_TO_START);
        this.redirect(pathsMaster.readyToStart);
      }
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

  private setGameData(teams: ITeam[], questions: IQuestion[], gameState?: IGameState): void {
    this.teams = teams;
    for (const team of this.teams) {
      if (team.points == null) {
        team.points = 0;
      }
    }
    this.questions = questions;
    if (gameState == null) {
      this.currentGameState = {
        currentQuestionNumber: 0,
      };
    }
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
      teams: this.teams,
      question: this.questions,
      gameState: this.currentGameState
    };
    const json = JSON.stringify(gameStateAsJson);
    const blob = new Blob([json], {type: 'text/json'});
    const url = window.URL.createObjectURL(blob);
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  public importGameStateFromJson(gameState: IGameStateAsJson): void {
    this.currentGameState = gameState.gameState;
    this.setupGame(gameState.teams, gameState.question);
  }

  public getGameName(): string {
    return config.gameName + ' ' + config.masterName;
  }
}
