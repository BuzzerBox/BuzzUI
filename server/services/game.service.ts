import {WebSocketConnection} from "../objects/web-socket-connection";
import {WebSocketService} from "./web-socket.service";
import {Observable, Subscription} from "rxjs";
import {
    EAnswerStates,
    EGameStates,
    EGradeResults,
    GameStateHelper,
    GameFormatHelper,
    RoundRulesHelper,
    EMediaStates,
    MediaHelper,
    EPacketTypes,
    EQuestionAnswerStates,
    IAnswer,
    IAnswerSetStatePacket,
    IBuzzer,
    IDataForScreenPacket,
    IEndGamePacket,
    IGamePacket,
    IGameState,
    IGradeAnswerPacket,
    IInstallUpdatePacket,
    IKeypressOnScreenPacket,
    IMarkTeamPacket,
    INewMasterAccepted,
    IPresetupAvailableInfoPacket,
    IQuestion,
    IRound,
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
    ISetWagerPacket,
    IFinalRoundProgress,
    IJeopardyRoundProgress,
    ISetupPacket,
    IStartGamePacket,
    IStorageAccessPacket,
    IMasterTakenOverPacket,
    IAutosaveInfoPacket,
    ITeam,
    ITeamSetPointsPacket,
    IUpdateInfoPacket,
    IUpdateMediaStatePacket,
    IUpdateTeamsPacket,
    PacketHelper
} from "../../shared/shared";
import config from '../../config.json';
import * as Uuid from 'uuid';
import {LoggerService} from './logger.service';
import {MicroControllerSerialAdapter} from '../objects/adapters/MicroControllerSerialAdapter';
import {Buffer} from 'buffer';
import {SerialPortService} from './serial-port.service';
import {ConfigService} from './config.service';
import {toInteger} from 'lodash';
import {ObjectHelper} from '../../shared/helper/object.helper';
import {UpdateService} from './update.service';
import {StorageService} from './storage.service';
import {AutosaveService} from './autosave.service';
import {ClockService} from './clock.service';

enum LOOKUP_TEAM_CODE {
    BY_KEYPRESS,
    BY_BYTE
}

export class GameService {
    private static instance: GameService;
    private webSocketConnectionMaster: WebSocketConnection;
    // the device of the current or last master, see mayBecomeMaster()
    private lastMasterId: string | undefined;
    private webSocketConnectionsScreens: Map<string, WebSocketConnection>;
    private newConnectionEstablished$: Observable<WebSocketConnection>;
    private newConnectionEstablishedSubscription: Subscription;
    private newMessageMasterSubscription: Subscription;
    private currentStateInAutomaton: EGameStates;
    private previousStateInAutomaton: EGameStates;
    private buzzerConfig: IBuzzer[];
    private teams: ITeam[] = [];
    private rounds: IRound[] = [];
    private currentGameState: IGameState;
    private keypressLocked = false;
    // whether the master that rejoined left a game that was already running, so starting it again continues it
    private resumesRunningGame = false;
    // whether the game was ended, for its saved state
    private gameFinished = false;
    private keyOrByteCodesInUse: string[] = [];
    private ignoredKeypresses: string[] = [];
    // TODO: maybe rename it to lastBuzzerPressed to reflect an upcoming change in behavior for this field
    private lastKeyPressed: string;
    private configInvalidReason: string;

    private constructor() {
        if (!this.validateConfig()) {
            throw new Error(this.configInvalidReason);
        }
        this.webSocketConnectionsScreens = new Map<string, WebSocketConnection>();
        this.currentGameState = this.makeInitialGameState();
        this.newConnectionEstablished$ = WebSocketService.get().start();
        this.newConnectionEstablishedSubscription = this.newConnectionEstablished$.subscribe(this.onNewConnection.bind(this))
        // When this is instantiated, the game is looking for a master
        this.setNewState(EGameStates.WAITING_FOR_MASTER);
        // call this once to read config and create necessary variables
        this.getBuzzerConfig();
        SerialPortService.get().addOnDataInCallback(this.onSerialDataIn.bind(this));
        SerialPortService.get().addOnErrorCallback(this.onSerialError.bind(this));
        UpdateService.get().observeInfo().subscribe(info => this.sendToMaster<IUpdateInfoPacket>(info));
        AutosaveService.get().observeInfo().subscribe(info => this.sendToMaster<IAutosaveInfoPacket>(info));
    }

    public static get(): GameService {
        if (this.instance == null) {
            this.instance = new GameService()
        }
        return this.instance;
    }

    public static startGame(): void {
        // starts the game by instantiating is
        this.get();
    }

    private onNewConnection(con: WebSocketConnection) {
        console.dir("new connection");

        // wait until the first packet to determine whether it is a master or a screen
        const sub = con.onMessage().subscribe((packet: IGamePacket) => {
            // a broken packet must not take the server and the running game down
            try {
                this.onPacket(con, sub, packet);
                // most packets change the game; the autosave only writes once things calm down
                if (this.isGameSetUp()) {
                    AutosaveService.get().changed();
                }
            } catch (e) {
                LoggerService.error(`Could not handle packet ${JSON.stringify(packet)}`, e);
            }
        })
    }

    private onPacket(con: WebSocketConnection, sub: Subscription, packet: IGamePacket): void {
        // the "sub" will be unsubscribed in the onRegisterMasterPacket
        if (packet.packetType === EPacketTypes.REGISTER_MASTER) {
            this.onRegisterMasterPacket(con, sub, packet as IRegisterMasterPacket);
        } else if (packet.packetType === EPacketTypes.REGISTER_SCREEN) {
            this.onRegisterScreenPacket(con, sub, packet as IRegisterScreenPacket);
        } else  if (packet.packetType === EPacketTypes.KEYPRESS_ON_SCREEN) {
            this.onKeypressOnScreenPacket(packet as IKeypressOnScreenPacket);
        } else if (packet.packetType === EPacketTypes.UPDATE_MEDIA_STATE) {
            // screens send this as well, when the media they play has ended
            this.onUpdateMediaStatePacket(packet as IUpdateMediaStatePacket);
        } else if (con !== this.webSocketConnectionMaster) {
            LoggerService.warn(`Ignoring packet ${EPacketTypes[packet.packetType]} since only the master may send it`);
        } else if (packet.packetType === EPacketTypes.SETUP_GAME) {
            this.onSetupGamePackage(packet as ISetupPacket);
        } else if (packet.packetType === EPacketTypes.START_GAME) {
            this.onStartGamePacket(packet as IStartGamePacket);
        } else if (packet.packetType === EPacketTypes.TEAM_SET_POINTS) {
            this.onTeamSetPointsPacket(packet as ITeamSetPointsPacket);
        } else if (packet.packetType === EPacketTypes.ANSWER_SET_STATE) {
            this.onAnswerSetStatePacket(packet as IAnswerSetStatePacket);
        } else if (packet.packetType === EPacketTypes.SET_QUESTION) {
            this.onSetQuestionPacket(packet as ISetQuestionPacket);
        } else if (packet.packetType === EPacketTypes.SET_ROUND) {
            this.onSetRoundPacket(packet as ISetRoundPacket);
        } else if (packet.packetType === EPacketTypes.SELECT_QUESTION) {
            this.onSelectQuestionPacket(packet as ISelectQuestionPacket);
        } else if (packet.packetType === EPacketTypes.SET_PICKING_TEAM) {
            this.onSetPickingTeamPacket(packet as ISetPickingTeamPacket);
        } else if (packet.packetType === EPacketTypes.SET_WAGER) {
            this.onSetWagerPacket(packet as ISetWagerPacket);
        } else if (packet.packetType === EPacketTypes.END_GAME) {
            this.onEndGamePacket(packet as IEndGamePacket);
        } else if (packet.packetType === EPacketTypes.RESET_SERVER) {
            this.onResetServerPacket(packet as IResetServerPacket);
        } else if (packet.packetType === EPacketTypes.MARK_TEAM) {
            this.onMarkTeamPacket(packet as IMarkTeamPacket);
        } else if (packet.packetType === EPacketTypes.SET_BUZZER_LOCK) {
            // releasing from the master is like the soft release on the box: the team that buzzed is no longer marked
            if (!(packet as ISetBuzzerLockPacket).setLock) {
                this.unmarkAllTeams();
            }
            this.onSetBuzzerLockPacket(con, packet as ISetBuzzerLockPacket);
        } else if (packet.packetType === EPacketTypes.SET_MEDIA_VOLUME) {
            this.onSetMediaVolumePacket(packet as ISetMediaVolumePacket);
        } else if (packet.packetType === EPacketTypes.GRADE_ANSWER) {
            this.onGradeAnswerPacket(packet as IGradeAnswerPacket);
        } else if (packet.packetType === EPacketTypes.UPDATE_TEAMS) {
            this.onUpdateTeamsPacket(packet as IUpdateTeamsPacket);
        } else if (packet.packetType === EPacketTypes.INSTALL_UPDATE) {
            this.onInstallUpdatePacket(packet as IInstallUpdatePacket);
        }
    }

    private isGameSetUp(): boolean {
        return this.isGameRunning() || this.currentStateInAutomaton === EGameStates.END;
    }

    /**
     * A game is set up and not over yet
     */
    private isGameRunning(): boolean {
        return [EGameStates.WAITING_FOR_START, EGameStates.PLAYING, EGameStates.LOST_MASTER].includes(this.currentStateInAutomaton);
    }

    /**
     * A running game whose master lost its connection waits for that device, see IRegisterMasterPacket.masterId;
     * another one that just tries to become the master (e.g. by itself, from the already-registered page) would grab it
     */
    private mayBecomeMaster(packet: IRegisterMasterPacket): boolean {
        return this.currentStateInAutomaton !== EGameStates.LOST_MASTER || !!packet.takeOver || packet.masterId === this.lastMasterId;
    }

    private makeAutosaveSnapshot() {
        return {teams: this.teams, gameState: this.currentGameState, finished: this.gameFinished};
    }

    private onMasterConnectionDestroy(): void {
        LoggerService.log('Connection to master was closed');
        this.webSocketConnectionMaster = null;
        StorageService.get().revokeAccessToken();
        if (this.currentStateInAutomaton === EGameStates.WAITING_FOR_SETUP) {
            this.setNewState(EGameStates.WAITING_FOR_MASTER);
        } else if (this.currentStateInAutomaton === EGameStates.END) {
            this.resetServerData();
            this.setNewState(EGameStates.WAITING_FOR_MASTER);
            this.previousStateInAutomaton = null;
            // screens still show the scores of the ended game; reloading takes them back to waiting for the next one
            this.sendToAllScreens<IResetServerPacket>({packetType: EPacketTypes.RESET_SERVER});
        } else {
            this.setNewState(EGameStates.LOST_MASTER);
        }
    }

    private setNewState(newState: EGameStates): void {
        LoggerService.log(`setting new state: ${EGameStates[newState]}`);
        this.previousStateInAutomaton = this.currentStateInAutomaton;
        this.currentStateInAutomaton = newState;
        // the master can only install updates while setting up
        UpdateService.get().setPolling(newState === EGameStates.WAITING_FOR_SETUP);
    }

    private getBuzzerConfig(): IBuzzer[] {
        if (this.buzzerConfig == null) {
            this.buzzerConfig = [];
            // check if no key was used more than once
            const keys: string[] = [];
            for (const buzzConf of ConfigService.get().buzzers) {
                const eKeyBind = buzzConf.key;
                if (keys.includes(eKeyBind))
                {
                    throw new Error("Cannot used the same key bind more than once");
                }
                keys.push(eKeyBind);
            }
            for (const buzzConf of ConfigService.get().buzzers) {
                const id: string = Uuid.v4();
                const c: IBuzzer = {
                    name: buzzConf.name,
                    id,
                    keyBind: buzzConf.key,
                    byteBind: buzzConf.byte.toString(10)
                    // TODO remove EKeyBind
                }
                this.buzzerConfig.push(c);
                this.keyOrByteCodesInUse.push(c.byteBind);
                this.keyOrByteCodesInUse.push(c.keyBind);
            }
        }
        return this.buzzerConfig;
    }

    private onSetupGamePackage(packet: ISetupPacket): void {
        if (this.currentStateInAutomaton !== EGameStates.WAITING_FOR_SETUP) {
            return;
        }
        let packetOk = true;
        // check if at least two teams are defined
        if (packet.teams.length < 2) {
            packetOk = false;
        }
        // the questions get IDs if they lack them, the same way as when a version is loaded
        const rounds = GameFormatHelper.checkRounds(packet.rounds);
        if (rounds == null) {
            LoggerService.warn('Ignoring a game with rounds this version can\'t play');
            packetOk = false;
        }

        const responsePacket: IResponsePacket = {
            packetType: EPacketTypes.RESPONSE_PACKET,
            responseTo: EPacketTypes.SETUP_GAME,
            wasSuccessful: packetOk
        }

        if (packetOk) {
            this.teams = packet.teams;
            this.rounds = rounds;
            // a new game is set up without a game state; a loaded save may lack fields added since it was made
            this.currentGameState = GameFormatHelper.migrateGameState({...this.makeInitialGameState(), ...packet.currentGameState}, this.rounds);
            // a savegame can't lock the buzzers, only a buzzer press can
            this.currentGameState.setBuzzerLock = this.keypressLocked;
            // chosen for this game; it is saved with the state, so a continued game keeps it
            if (packet.themeId) {
                this.currentGameState.themeId = packet.themeId;
            }
            this.resumesRunningGame = false;
            this.gameFinished = false;
            this.setNewState(EGameStates.WAITING_FOR_START);
            if (packet.storage != null) {
                AutosaveService.get().begin(packet.storage, !!packet.isNewState, this.makeAutosaveSnapshot.bind(this));
            } else {
                AutosaveService.get().end();
            }
        }
        this.sendToMaster<IResponsePacket>(responsePacket);

        this.sendToAllScreens<IDataForScreenPacket>(this.makeInitDataForScreen())
    }

    private onRegisterMasterPacket(con: WebSocketConnection, sub: Subscription, packet: IRegisterMasterPacket): void {
        if (con === this.webSocketConnectionMaster) {
            // the master sent this twice, e.g. once more after a reconnect; refusing would close its own connection
            this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, true));
            if (this.currentStateInAutomaton === EGameStates.WAITING_FOR_SETUP) {
                this.sendToMaster<IPresetupAvailableInfoPacket>({
                    packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO,
                    availableBuzzers: this.getBuzzerConfig()
                });
            }
            return;
        }
        if (this.webSocketConnectionMaster != null && packet.takeOver) {
            this.dropMaster();
        }
        if (this.webSocketConnectionMaster == null && this.mayBecomeMaster(packet)) {
            this.webSocketConnectionMaster = con;
            this.lastMasterId = packet.masterId;
            ClockService.get().setClientTime(packet.clientTime);
            // before anything that takes the master to pages that use the storage
            this.sendToMaster<IStorageAccessPacket>({
                packetType: EPacketTypes.STORAGE_ACCESS,
                token: StorageService.get().issueAccessToken()
            });
            // TODO: maybe also allow EGameStates.END as state for this one?
            if (this.currentStateInAutomaton === EGameStates.WAITING_FOR_MASTER) {
                this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, true));
                this.setNewState(EGameStates.WAITING_FOR_SETUP);
                this.sendToMaster<IPresetupAvailableInfoPacket>({
                    packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO,
                    availableBuzzers: this.getBuzzerConfig()
                })
            } else if (this.currentStateInAutomaton === EGameStates.LOST_MASTER) {
                if (this.previousStateInAutomaton === EGameStates.WAITING_FOR_START || this.previousStateInAutomaton === EGameStates.PLAYING) {
                    // a master leaving again before restarting keeps resuming the running game
                    if (this.previousStateInAutomaton === EGameStates.PLAYING) {
                        this.resumesRunningGame = true;
                    }
                    this.setNewState(EGameStates.WAITING_FOR_START);
                    this.sendToMaster<INewMasterAccepted>({
                        packetType: EPacketTypes.NEW_MASTER_ACCEPTED,
                        serverState: EGameStates.WAITING_FOR_START,
                        teams: this.teams,
                        rounds: this.rounds,
                        currentGameState: this.currentGameState,
                        availableBuzzers: this.getBuzzerConfig()
                    })
                }
            }

            this.webSocketConnectionMaster.addOnCloseCallback(() => {
                // a master that was taken over from is no longer the master when its connection closes at last
                if (this.webSocketConnectionMaster === con) {
                    this.onMasterConnectionDestroy();
                }
            });
            this.webSocketConnectionMaster.addOnCloseCallback(() => sub.unsubscribe());
            this.sendToMaster<IUpdateInfoPacket>(UpdateService.get().getInfo());
            this.sendToMaster<IAutosaveInfoPacket>(AutosaveService.get().getInfo());
        } else {
            con.send<IResponsePacket>({
                ...PacketHelper.makeResponsePacket(packet.packetType, false, 'Another master is connected'),
                isGameRunning: this.isGameRunning()
            });
            con.close();
            sub.unsubscribe();
        }
    }

    /**
     * Lets another device take over: the master is told and dropped right away, as if its connection was lost, since
     * the connection may take a while to close (or never answer again, if the device left the WiFi)
     */
    private dropMaster(): void {
        const oldMaster = this.webSocketConnectionMaster;
        LoggerService.log('Another device takes over as master');
        oldMaster.send<IMasterTakenOverPacket>({packetType: EPacketTypes.MASTER_TAKEN_OVER});
        this.onMasterConnectionDestroy();
        oldMaster.close();
    }

    /**
     * Installing an update restarts the server, so it is only allowed while no game is set up
     */
    private async onInstallUpdatePacket(packet: IInstallUpdatePacket): Promise<void> {
        const reason = this.currentStateInAutomaton !== EGameStates.WAITING_FOR_SETUP
            ? 'Updates can only be installed while no game is set up'
            : await UpdateService.get().install(packet.fileName, packet.allowUnsigned === true);
        if (reason != null) {
            LoggerService.warn(`Not installing update ${packet.fileName}: ${reason}`);
        }
        this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, reason == null, reason ?? undefined));
    }

    private onStartGamePacket(packet: IStartGamePacket): void {
        const isLegal = this.currentStateInAutomaton === EGameStates.WAITING_FOR_START;
        // a master that rejoined a running game restarts it: keep the media state the screens are showing
        const isRejoin = this.resumesRunningGame;
        if (isLegal) {
            this.setNewState(EGameStates.PLAYING);
            this.resumesRunningGame = false;
        }
        this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, isLegal));
        if (isLegal && isRejoin && this.currentGameState.mediaQuestionState) {
            this.onUpdateMediaStatePacket(PacketHelper.makeMediaStatePacketFromQuestionState(this.currentGameState.mediaQuestionState));
        } else if (isLegal) {
            let questionConfig = PacketHelper.getDefaultMediaState();
            if (this.getCurrentQuestion()?.initialConfig) {
                questionConfig = this.getCurrentQuestion().initialConfig;
            }
            this.currentGameState.mediaQuestionState = questionConfig;
            const mediaPacket: IUpdateMediaStatePacket = PacketHelper.makeMediaStatePacket(questionConfig.mediaState, questionConfig.questionState, questionConfig.answerState);
            this.onUpdateMediaStatePacket(mediaPacket);
        }
    }

    private onTeamSetPointsPacket(packet: ITeamSetPointsPacket): void {
        const team: ITeam = this.findTeam(packet.teamId);
        if (team != null) {
            team.points = packet.points;
        }
        this.sendToAllScreens<ITeamSetPointsPacket>(packet);
    }

    /**
     * Awards the team that buzzed the points the rules of the round give, e.g. in a classic round the points of the
     * question, twice them for a double answer, and takes them away for a wrong one. A correct answer solves the
     * question: it reveals the correct answer options and keeps the buzzers locked. A wrong one releases the buzzers for
     * the other teams.
     */
    private onGradeAnswerPacket(packet: IGradeAnswerPacket): void {
        const team: ITeam = this.findTeam(packet.teamId);
        const round = this.getCurrentRound();
        if (team == null || round == null) {
            LoggerService.warn(`Can't grade the answer of unknown team ${packet.teamId}`);
            return;
        }
        const rules = RoundRulesHelper.get(round);
        if (!rules.mayGrade(round, this.getCurrentProgress(), team.teamId)) {
            LoggerService.warn(`The rules of the round don't let the answer of ${team.name} be graded now`);
            return;
        }
        const question = this.getCurrentQuestion();
        const isCorrect = packet.result !== EGradeResults.WRONG;
        team.points = (team.points ?? 0) + rules.getGradePoints(round, this.getCurrentProgress(), packet.result, team.teamId);
        // e.g. a correct answer closes a Jeopardy tile; the master and the screens do the same with the packet
        this.currentGameState.roundProgress[round.id] = rules.afterGrade(round, this.getCurrentProgress(), team.teamId, packet.result);
        const pointsPacket: ITeamSetPointsPacket = {packetType: EPacketTypes.TEAM_SET_POINTS, teamId: team.teamId, points: team.points};
        this.sendToMaster<ITeamSetPointsPacket>(pointsPacket);
        this.sendToAllScreens<ITeamSetPointsPacket>(pointsPacket);
        // the answer the team gave lights up, or else for a correct answer all correct ones
        const givenAnswer = packet.answer ? question?.answers?.find(a => GameStateHelper.isSameAnswer(a, packet.answer)) : undefined;
        if (givenAnswer) {
            this.activateAnswer(givenAnswer);
        } else if (isCorrect && packet.revealCorrectAnswers) {
            (question?.answers ?? []).filter(a => a.isCorrect).forEach(a => this.activateAnswer(a));
        }
        if (!isCorrect) {
            this.unmarkAllTeams();
            this.setKeypressLocked(false);
            this.releaseHardwareBuzzerLock(true);
        }
        // the screens and the master flash the answers for a wrong one
        this.sendToMaster<IGradeAnswerPacket>(packet);
        this.sendToAllScreens<IGradeAnswerPacket>(packet);
    }

    private activateAnswer(answer: IAnswer): void {
        if ((this.currentGameState.activatedAnswers ?? []).some(a => GameStateHelper.isSameAnswer(a, answer))) {
            return;
        }
        const activatePacket = PacketHelper.makeAnswerSetSatePacket(EAnswerStates.ACTIVATE, answer);
        GameStateHelper.applyAnswerState(this.currentGameState, activatePacket);
        this.sendToMaster<IAnswerSetStatePacket>(activatePacket);
        this.sendToAllScreens<IAnswerSetStatePacket>(activatePacket);
    }

    /**
     * Renames, adds and removes teams of a game that is set up. Teams that stay keep their points, new ones start with
     * none. If the team that buzzed is removed, the buzzers are released.
     */
    private onUpdateTeamsPacket(packet: IUpdateTeamsPacket): void {
        if (this.currentStateInAutomaton !== EGameStates.WAITING_FOR_START && this.currentStateInAutomaton !== EGameStates.PLAYING) {
            return;
        }
        const buzzers = this.getBuzzerConfig();
        const requestedTeams = Array.isArray(packet.teams) ? packet.teams : [];
        const newTeams: ITeam[] = [];
        for (const requested of requestedTeams) {
            const buzzerIndex = buzzers.findIndex(buzzer => buzzer.id === requested?.buzzerId);
            const name = typeof requested?.name === 'string' ? requested.name.trim() : '';
            if (buzzerIndex < 0 || name === '' || newTeams.some(team => team.buzzerId === requested.buzzerId)) {
                newTeams.length = 0;
                break;
            }
            const existingTeam = this.findTeam(requested.buzzerId);
            newTeams.push({
                name,
                buzzerId: requested.buzzerId,
                teamId: requested.buzzerId,
                buzzerIndex,
                points: existingTeam?.points ?? 0
            });
        }
        // like in the setup, a game needs at least two teams
        if (newTeams.length < 2) {
            LoggerService.warn('Ignoring invalid teams', packet.teams);
            // let the master show the teams that are still in place
            this.sendToMaster<IUpdateTeamsPacket>({packetType: EPacketTypes.UPDATE_TEAMS, teams: this.teams});
            return;
        }
        this.teams = newTeams;
        const isRemoved = (teamId: string) => !newTeams.some(team => team.teamId === teamId);
        if ((this.currentGameState.markedTeamIds ?? []).some(isRemoved)) {
            this.unmarkAllTeams();
            this.setKeypressLocked(false);
            this.releaseHardwareBuzzerLock(true);
        }
        const updateTeamsPacket: IUpdateTeamsPacket = {packetType: EPacketTypes.UPDATE_TEAMS, teams: this.teams};
        this.sendToMaster<IUpdateTeamsPacket>(updateTeamsPacket);
        this.sendToAllScreens<IUpdateTeamsPacket>(updateTeamsPacket);
    }

    // TODO move to some shared resource
    private findTeam(teamId: string): ITeam {
        for (const team of this.teams) {
            if (teamId === team.teamId) {
                return team;
            }
        }
    }

    private onAnswerSetStatePacket(packet: IAnswerSetStatePacket): void {
        GameStateHelper.applyAnswerState(this.currentGameState, packet);
        // once all correct answers are revealed the question is done, so the buzzers stay locked
        if (packet.state === EAnswerStates.ACTIVATE && !GameStateHelper.areAllCorrectAnswersActivated(this.currentGameState, this.getCurrentQuestion())) {
            this.unmarkAllTeams();
            this.setKeypressLocked(false);
            this.releaseHardwareBuzzerLock(true);
            if (this.lastKeyPressed != null) {
                // if the answer is wrong an there is a last key press, then ignore it for this round
                // TODO: shall be configurable, will be done somewhat later
                // this.ignoredKeypresses.push(this.lastKeyPressed);
            }
        }
        this.sendToAllScreens(packet);
    }

    private onSetQuestionPacket(packet: ISetQuestionPacket): void {
        const round = this.getCurrentRound();
        const progress = round ? RoundRulesHelper.get(round).selectQuestion(round, this.getCurrentProgress(), packet.set) : null;
        if (progress != null) {
            this.currentGameState.roundProgress[round.id] = progress;
        }
        this.sendToAllScreens(packet);
        this.showCurrentQuestion();
    }

    /**
     * Goes on with another round, where it was left
     */
    private onSetRoundPacket(packet: ISetRoundPacket): void {
        if (GameFormatHelper.getRound(this.rounds, packet.roundId) == null) {
            LoggerService.warn(`Ignoring unknown round ${packet.roundId}`);
            return;
        }
        this.currentGameState.currentRoundId = packet.roundId;
        this.sendToAllScreens(packet);
        this.showCurrentQuestion();
    }

    /**
     * Opens a tile of the Jeopardy board, or goes back to the board; shows the question of the final
     */
    private onSelectQuestionPacket(packet: ISelectQuestionPacket): void {
        const round = this.getCurrentRound();
        let progress: IJeopardyRoundProgress | IFinalRoundProgress | null = null;
        if (round?.mode === 'jeopardy') {
            progress = RoundRulesHelper.jeopardy.applySelectQuestion(round, this.getCurrentProgress() as IJeopardyRoundProgress, packet);
        } else if (round?.mode === 'final') {
            progress = RoundRulesHelper.final.applySelectQuestion(round, this.getCurrentProgress() as IFinalRoundProgress, packet);
        }
        if (progress == null) {
            LoggerService.warn(`Ignoring the selection of question ${packet.questionId}, which isn't on the board or is played`);
            return;
        }
        this.currentGameState.roundProgress[round.id] = progress;
        this.sendToAllScreens(packet);
        this.showCurrentQuestion();
    }

    /**
     * What a team wagers on a Daily Double or in the final, kept within what it may wager
     */
    private onSetWagerPacket(packet: ISetWagerPacket): void {
        const round = this.getCurrentRound();
        const team = this.findTeam(packet.teamId);
        let progress: IJeopardyRoundProgress | IFinalRoundProgress | null = null;
        if (team != null && round?.mode === 'jeopardy') {
            progress = RoundRulesHelper.jeopardy.applySetWager(round, this.getCurrentProgress() as IJeopardyRoundProgress, team.teamId, packet.wager, team.points ?? 0);
        } else if (team != null && round?.mode === 'final') {
            progress = RoundRulesHelper.final.applySetWager(round, this.getCurrentProgress() as IFinalRoundProgress, team.teamId, packet.wager, team.points ?? 0);
        }
        if (progress == null) {
            LoggerService.warn(`Ignoring the wager ${packet.wager} of team ${packet.teamId}`);
            return;
        }
        this.currentGameState.roundProgress[round.id] = progress;
        // the master and the screens take what was kept, which may be less than was asked for
        const wagerPacket = PacketHelper.makeSetWagerPacket(team.teamId, progress.wagers[team.teamId]);
        this.sendToMaster<ISetWagerPacket>(wagerPacket);
        this.sendToAllScreens<ISetWagerPacket>(wagerPacket);
    }

    private onSetPickingTeamPacket(packet: ISetPickingTeamPacket): void {
        const round = this.getCurrentRound();
        if (round?.mode !== 'jeopardy' || (packet.teamId != null && this.findTeam(packet.teamId) == null)) {
            LoggerService.warn(`Ignoring the picking team ${packet.teamId}`);
            return;
        }
        this.currentGameState.roundProgress[round.id] = RoundRulesHelper.jeopardy.applySetPickingTeam(this.getCurrentProgress() as IJeopardyRoundProgress, packet.teamId);
        this.sendToAllScreens(packet);
    }

    /**
     * Starts the question that is current now: from no progress, with the buzzers released and its media as it starts
     */
    private showCurrentQuestion(): void {
        GameStateHelper.resetQuestionProgress(this.currentGameState);
        const lockPacket: ISetBuzzerLockPacket = PacketHelper.makeBuzzerLockPacket(false);
        this.onSetBuzzerLockPacket(null, lockPacket);
        this.ignoredKeypresses = [];
        const questionConfig = this.getCurrentQuestion()?.initialConfig ?? PacketHelper.getDefaultMediaState();
        this.currentGameState.mediaQuestionState = questionConfig;
        const mediaPacket: IUpdateMediaStatePacket = PacketHelper.makeMediaStatePacket(questionConfig.mediaState, questionConfig.questionState, questionConfig.answerState);
        this.onUpdateMediaStatePacket(mediaPacket);
    }

    private getCurrentRound(): IRound | undefined {
        return GameFormatHelper.getCurrentRound(this.rounds, this.currentGameState);
    }

    private getCurrentProgress() {
        return GameFormatHelper.getCurrentProgress(this.currentGameState);
    }

    private getCurrentQuestion(): IQuestion | undefined {
        return GameFormatHelper.getCurrentQuestion(this.rounds, this.currentGameState);
    }

    /**
     * Whether the rules of the round let the team buzz now
     */
    private mayBuzz(team: ITeam): boolean {
        const round = this.getCurrentRound();
        return round != null && RoundRulesHelper.get(round).mayBuzz(round, this.getCurrentProgress(), team.teamId);
    }

    private getIdOfAnswer(answer: IAnswer): number {
        const answers = this.getCurrentQuestion().answers;
        for (let i = 0; i < answers.length; i++) {
            if (answers[i] === answer) {
                return i;
            }
        }
        // if the answer was not found in the current question, return some number less than zero
        return -1;
    }

    private onEndGamePacket(packet: IEndGamePacket): void {
        this.setNewState(EGameStates.END);
        this.gameFinished = true;
        this.sendToAllScreens(packet);
    }

    private onRegisterScreenPacket(con: WebSocketConnection, sub: Subscription, packet: IRegisterScreenPacket): void {
        this.webSocketConnectionsScreens.set(packet.screenId, con);
        if (this.currentStateInAutomaton === EGameStates.WAITING_FOR_START || this.currentStateInAutomaton === EGameStates.LOST_MASTER || this.currentStateInAutomaton === EGameStates.PLAYING) {
            con.send<IDataForScreenPacket>(this.makeInitDataForScreen());
        }
        con.addOnCloseCallback(() => {
            con.close();
            sub.unsubscribe();
            this.webSocketConnectionsScreens.delete(packet.screenId);
        });
    }

    private sendToAllScreens<T extends IGamePacket>(packet: T): void {
        this.webSocketConnectionsScreens.forEach((con) => {
            con.send<T>(packet);
        })
    }

    private makeInitDataForScreen(): IDataForScreenPacket {
        return {
            packetType: EPacketTypes.DATA_FOR_SCREEN,
            teams: this.teams,
            // the notes are for the game master only
            rounds: GameFormatHelper.mapQuestions(this.rounds, ({notes, ...question}) => question),
            gameState: this.currentGameState
        }
    }

    private onResetServerPacket(packet: IResetServerPacket): void {
        this.setNewState(EGameStates.WAITING_FOR_SETUP);
        this.sendToMaster<IPresetupAvailableInfoPacket>({
            packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO,
            availableBuzzers: this.getBuzzerConfig()
        });
        this.sendToAllScreens(packet);
        this.resetServerData();
    }

    private resetServerData(): void {
        // saves the game as it was, before it is cleared
        AutosaveService.get().end();
        this.teams = [];
        this.rounds = [];
        this.setKeypressLocked(false)
        this.releaseHardwareBuzzerLock(true);
        this.ignoredKeypresses = [];
        this.lastKeyPressed = null;
        this.resumesRunningGame = false;
        this.currentGameState = this.makeInitialGameState();
    }

    private makeInitialGameState(): IGameState {
        return {
            mediaQuestionState: {
                mediaState: EMediaStates.NO_MEDIA,
                questionState: EQuestionAnswerStates.SHOWN,
                answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA
            },
            mediaVolume: PacketHelper.getDefaultMediaVolume(),
            currentRoundId: '',
            roundProgress: {},
            markedTeamIds: [],
            loggedAnswers: [],
            activatedAnswers: [],
            setBuzzerLock: this.keypressLocked
        };
    }

    // TODO: create method to send to all screens AND master
    private onKeypressOnScreenPacket(packet: IKeypressOnScreenPacket): void {
        if (!ConfigService.get().enableBrowserKeypressEvents) {
            return;
        }
        if (packet.keyCode === ConfigService.get().softReleaseKey) {
            this.releaseHardwareBuzzerLock(true);
            this.unmarkAllTeams();
        } else if (!this.isKeypressLocked() && !this.ignoredKeypresses.includes(packet.keyCode)) {
            const team: ITeam = this.getTeamForKeyPressCode(packet.keyCode);
            if (team == null) {
                LoggerService.log("no team found for keycode " + packet.keyCode)
                return;
            }
            if (!this.mayBuzz(team)) {
                return;
            }
            this.lastKeyPressed = packet.keyCode;
            this.lockOnTeam(team);
        }
    }

    private releaseHardwareBuzzerLock(sendSerial: boolean = false) {
        const lockPacket: ISetBuzzerLockPacket = PacketHelper.makeBuzzerLockPacket(false);
        this.onSetBuzzerLockPacket(null, lockPacket, sendSerial);
    }

    private setKeypressLocked(locked: boolean): void {
        this.keypressLocked = locked;
        this.currentGameState.setBuzzerLock = locked;
    }

    private unmarkAllTeams(): void {
        const unmarkTeamsPacket: IMarkTeamPacket = PacketHelper.makeUnmarkAllTeamsPacket();
        GameStateHelper.applyMarkTeam(this.currentGameState, unmarkTeamsPacket);
        this.sendToMaster<IMarkTeamPacket>(unmarkTeamsPacket);
        this.sendToAllScreens<IMarkTeamPacket>(unmarkTeamsPacket);
    }

    /**
     * The master may be gone (e.g. while it reconnects), then there is nobody to tell
     */
    private sendToMaster<T extends IGamePacket>(packet: T): void {
        if (this.webSocketConnectionMaster != null) {
            this.webSocketConnectionMaster.send<T>(packet);
        }
    }

    private isKeypressLocked(): boolean {
        return this.keypressLocked;
    }

    /**
     * This is the look-up function for keypress codes (e.g. from the browser)
     * @param keyCode
     * @private
     */
    private getTeamForKeyPressCode(keyCode: string): ITeam {
        // TODO: remove once tested
        /*if (!this.keyOrByteCodesInUse.includes(keyCode)) {
            return null;
        }
        let b: IBuzzer;
        for (const buzzer of this.getBuzzerConfig()) {
            if (buzzer.keyBind === keyCode) {
                b = buzzer;
            }
        }
        if (b == null) {
            return null;
        }
        for (const team of this.teams) {
            if (b.id === team.buzzerId) {
                LoggerService.log("found team " + team.name + " to match keypress " + keyCode);
                return team;
            }
        }
        return null;*/
        return this.getTeamForByteOrKeyPressCode(keyCode, LOOKUP_TEAM_CODE.BY_KEYPRESS);
    }

    private getTeamForByteCode(byteCode: string): ITeam {
        // TODO: remove once tested
        /*if (!this.keyOrByteCodesInUse.includes(byteCode)) {
            return null;
        }
        let b: IBuzzer;
        for (const buzzer of this.getBuzzerConfig()) {
            if (buzzer.byteBind === byteCode) {
                b = buzzer;
            }
        }
        if (b == null) {
            return null;
        }
        for (const team of this.teams) {
            if (b.id === team.buzzerId) {
                LoggerService.log("found team " + team.name + " to match byte " + byteCode);
                return team;
            }
        }
        return null;*/
        return this.getTeamForByteOrKeyPressCode(byteCode, LOOKUP_TEAM_CODE.BY_BYTE);
    }

    private getTeamForByteOrKeyPressCode(code: string, mode: LOOKUP_TEAM_CODE): ITeam {
        if (!this.keyOrByteCodesInUse.includes(code)) {
            return null;
        }
        let b: IBuzzer;
        for (const buzzer of this.getBuzzerConfig()) {
            if (mode === LOOKUP_TEAM_CODE.BY_BYTE) {
                if (buzzer.byteBind === code) {
                    b = buzzer;
                }
            } else if (mode === LOOKUP_TEAM_CODE.BY_KEYPRESS) {
                if (buzzer.keyBind === code) {
                    b = buzzer;
                }
            } else {
                return null;
            }
        }
        if (b == null) {
            return null;
        }
        for (const team of this.teams) {
            if (b.id === team.buzzerId) {
                if (mode === LOOKUP_TEAM_CODE.BY_KEYPRESS) {
                    LoggerService.log("found team " + team.name + " to match keypress " + code);
                } else if (mode === LOOKUP_TEAM_CODE.BY_BYTE) {
                    LoggerService.log("found team " + team.name + " to match byte " + code);
                }
                return team;
            }
        }
        if (mode === LOOKUP_TEAM_CODE.BY_KEYPRESS) {
            LoggerService.warn("No team found for keypress " + code);
        } else if (mode === LOOKUP_TEAM_CODE.BY_BYTE) {
            LoggerService.warn("No team found for byte " + code);
        }
        return null;
    }

    private onMarkTeamPacket(packet: IMarkTeamPacket): void {
        GameStateHelper.applyMarkTeam(this.currentGameState, packet);
        this.sendToMaster<IMarkTeamPacket>(packet);
        this.sendToAllScreens<IMarkTeamPacket>(packet);
    }

    private validateConfig(): boolean {
        // check that buzzers are present
        if (ConfigService.get().buzzers == null) {
            this.configInvalidReason = "No buzzers are configured";
            return false;
        }

        // check that at least 2 buzzers are present
        if (ConfigService.get().buzzers.length < 2) {
            this.configInvalidReason = "Less than two buzzers are configured";
            return false;
        }

        return true;
    }

    private onSetBuzzerLockPacket(con: WebSocketConnection, packet: ISetBuzzerLockPacket, sendSerial: boolean = true): void {
        this.setKeypressLocked(packet.setLock);
        // it is very likely, that the master already reloaded the page, thus this is null
        this.sendToMaster<ISetBuzzerLockPacket>(packet);
        this.sendToAllScreens<ISetBuzzerLockPacket>(packet);
        // release the lock via i2c if necessary
        if (sendSerial && !packet.setLock) {
            // MicroControllerI2CAdapter.releaseBuzzerLock().catch(this.handleI2CError);
            MicroControllerSerialAdapter.sendSerialCommandReleaseLock();
        }
    }

    private onUpdateMediaStatePacket(packet: IUpdateMediaStatePacket): void {
        // remember the state so screens and masters that (re)connect get what is currently shown
        this.currentGameState.mediaQuestionState = packet.mediaQuestionState;
        this.sendToMaster<IUpdateMediaStatePacket>(packet);
        this.sendToAllScreens<IUpdateMediaStatePacket>(packet);
    }

    private onSetMediaVolumePacket(packet: ISetMediaVolumePacket): void {
        this.currentGameState.mediaVolume = packet.mediaVolume;
        this.sendToMaster<ISetMediaVolumePacket>(packet);
        this.sendToAllScreens<ISetMediaVolumePacket>(packet);
    }

    private startMicroControllerI2CPolling(): void {
        // setInterval(this.handleMicroControllerI2CRead.bind(this), parseInt(config.i2c.pollingInMS, 10));
    }

    /*private async handleMicroControllerI2CRead(): Promise<void> {
        if (await MicroControllerI2CAdapter.isBuzzerLockActive()) {
            const buzzerNumber: number = await MicroControllerI2CAdapter.getPressedBuzzer();
            console.log("got number " + buzzerNumber);
            if (0 <= buzzerNumber && buzzerNumber <= 9) {
                this.handlePressedBuzzer(buzzerNumber);
            }
        } else {
            // console.log("no buzzer lock active");
            const buzzerNumber: number = await MicroControllerI2CAdapter.getPressedBuzzer();
            console.log("got number " + buzzerNumber);
            if (0 <= buzzerNumber && buzzerNumber <= 9) {
                this.handlePressedBuzzer(buzzerNumber);
            } else if (buzzerNumber === 127) {
                this.handleIdleSituation();
            }
        }
    }*/

    private handleI2CError(e): void {
        console.log("I2C error occured", e);
    }

    private handlePressedBuzzer(buzzerNumber: number): void {
        const lockPacket: ISetBuzzerLockPacket =  PacketHelper.makeBuzzerLockPacket(true);
        const markTeamPacket: IMarkTeamPacket = PacketHelper.makeMarkTeamPacket(this.teams[buzzerNumber].teamId, true);
        this.sendToMaster<ISetBuzzerLockPacket>(lockPacket);
        this.sendToMaster<IMarkTeamPacket>(markTeamPacket);
        this.sendToAllScreens<ISetBuzzerLockPacket>(lockPacket);
        this.sendToAllScreens<IMarkTeamPacket>(markTeamPacket);
    }

    private handleIdleSituation(): void {
        const lockPacket: ISetBuzzerLockPacket =  PacketHelper.makeBuzzerLockPacket(false);
        const markTeamPacket: IMarkTeamPacket = PacketHelper.makeUnmarkAllTeamsPacket();
        this.sendToMaster<ISetBuzzerLockPacket>(lockPacket);
        this.sendToMaster<IMarkTeamPacket>(markTeamPacket);
        this.sendToAllScreens<ISetBuzzerLockPacket>(lockPacket);
        this.sendToAllScreens<IMarkTeamPacket>(markTeamPacket);
    }

    private onSerialDataIn(data: Buffer): void {
        // one chunk of data can hold several bytes, e.g. when two buzzers were pressed right after each other
        for (const byte of data) {
            // like a broken packet, a failing buzzer press must not take the server down
            try {
                this.onSerialByteIn(byte);
                if (this.isGameSetUp()) {
                    AutosaveService.get().changed();
                }
            } catch (e) {
                LoggerService.error(`Could not handle serial byte ${byte}`, e);
            }
        }
    }

    private onSerialByteIn(byte: number): void {
        const c: typeof config = ConfigService.get();
        // the config writes the bytes as their hex digits, e.g. 0x31 as 31
        const input: number = toInteger(byte.toString(16).padStart(2, '0'));
        if (input === c.softReleaseByte) {
            this.unmarkAllTeams();
            this.setKeypressLocked(false);
            this.releaseHardwareBuzzerLock(false);
        } else {
            const inputAsString = input.toString(10);
            if (!this.isKeypressLocked() && !this.ignoredKeypresses.includes(inputAsString)) {
                const team: ITeam = this.getTeamForByteCode(inputAsString);
                if (team == null) {
                    LoggerService.error("no team found for byte code " + inputAsString)
                    return;
                }
                if (!this.mayBuzz(team)) {
                    // the box locked on the team anyway
                    this.releaseHardwareBuzzerLock(true);
                    return;
                }
                this.lockOnTeam(team);
            }
        }
    }

    private lockOnTeam(team: ITeam) {
        ObjectHelper.ensureNotNull(team);
        this.setKeypressLocked(true);
        const markTeamPacket: IMarkTeamPacket = PacketHelper.makeMarkTeamPacket(team.teamId, true);
        GameStateHelper.applyMarkTeam(this.currentGameState, markTeamPacket);
        this.sendToMaster<IMarkTeamPacket>(markTeamPacket);
        const buzzerLockPacket = PacketHelper.makeBuzzerLockPacket(true);
        this.sendToMaster<ISetBuzzerLockPacket>(buzzerLockPacket)
        // only pause the media: keep question/answer visibility as it is, but leave fullscreen so the screens show who buzzed.
        // Only a video or audio that plays is paused. An image or slideshow keeps its state: PAUSED would hide it, as it
        // is what the master hides it with.
        const mediaQuestionState = this.currentGameState.mediaQuestionState;
        const isPlaying = (mediaQuestionState?.mediaState === EMediaStates.PLAYING
                || mediaQuestionState?.mediaState === EMediaStates.RESET)
            && MediaHelper.isPlayable(this.getCurrentQuestion()?.mediaDetails);
        const mediaStateUpdatePacket = PacketHelper.makeMediaStatePacketFromQuestionState({
            ...mediaQuestionState,
            mediaState: isPlaying ? EMediaStates.PAUSED : mediaQuestionState?.mediaState,
            fullscreen: false
        });
        this.onUpdateMediaStatePacket(mediaStateUpdatePacket);
        this.sendToAllScreens<IMarkTeamPacket>(markTeamPacket);
        this.sendToAllScreens<ISetBuzzerLockPacket>(buzzerLockPacket);
    }

    private onSerialError(err): void {
        // TODO
        console.log('Serial Error', err);
    }
}
