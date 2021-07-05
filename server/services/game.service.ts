import {WebSocketConnection} from "../objects/web-socket-connection";
import {WebSocketService} from "./web-socket.service";
import {Observable, Subscription} from "rxjs";
import {
    EGameStates,
    EPacketTypes,
    IPresetupAvailableInfoPacket,
    IGamePacket,
    IResponsePacket,
    IBuzzer,
    EKeyBinds,
    ISetupPacket,
    ITeam,
    IQuestion,
    IRegisterMasterPacket,
    INewMasterAccepted,
    IGameState,
    IStartGamePacket,
    ITeamSetPointsPacket,
    IAnswerSetStatePacket,
    ISetQuestionPacket,
    IAnswer,
    IEndGamePacket,
    IRegisterScreenPacket,
    IDataForScreenPacket,
    IResetServerPacket,
    IKeypressOnScreenPacket,
    IMarkTeamPacket,
    EAnswerStates,
    ISetBuzzerLockPacket,
    PacketHelper
} from "../../shared/shared";
import config from '../../config.json';
import * as Uuid from 'uuid';
import {LoggerService} from "./logger.service";
import {MicroControllerI2CAdapter} from "../objects/adapters/MicroControllerI2C.adapter";

export class GameService {
    private static instance: GameService;
    private webSocketConnectionMaster: WebSocketConnection;
    private webSocketConnectionsScreens: Map<string, WebSocketConnection>;
    private newConnectionEstablished$: Observable<WebSocketConnection>;
    private newConnectionEstablishedSubscription: Subscription;
    private newMessageMasterSubscription: Subscription;
    private currentStateInAutomaton: EGameStates;
    private previousStateInAutomaton: EGameStates;
    private buzzerConfig: IBuzzer[];
    private teams: ITeam[];
    private questions: IQuestion[];
    private currentGameState: IGameState;
    private keypressLocked = false;
    private keyCodesInUse: string[] = [];
    private ignoredKeypresses: string[] = [];
    private lastKeyPressed: string;
    private configInvalidReason: string;

    private constructor() {
        if (!this.validateConfig()) {
            throw new Error(this.configInvalidReason);
        }
        this.webSocketConnectionsScreens = new Map<string, WebSocketConnection>();
        this.newConnectionEstablished$ = WebSocketService.get().start();
        this.newConnectionEstablishedSubscription = this.newConnectionEstablished$.subscribe(this.onNewConnection.bind(this))
        // When this is instantiated, the game is looking for a master
        this.setNewState(EGameStates.WAITING_FOR_MASTER);
        // call this once to read config and create necessary variables
        this.getBuzzerConfig();
        // this.startMicroControllerI2CPolling();
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
        // console.dir(con);

        // wait until the first packet to determine whether it is a master or a screen
        const sub = con.onMessage().subscribe((packet: IGamePacket) => {
            // the "sub" will be unsubscribed in the onRegisterMasterPacket
            if (packet.packetType === EPacketTypes.REGISTER_MASTER) {
                this.onRegisterMasterPacket(con, sub, packet as IRegisterMasterPacket);
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
            } else if (packet.packetType === EPacketTypes.END_GAME) {
                this.onEndGamePacket(packet as IEndGamePacket);
            } else if (packet.packetType === EPacketTypes.REGISTER_SCREEN) {
                this.onRegisterScreenPacket(con, sub, packet as IRegisterScreenPacket);
            } else if (packet.packetType === EPacketTypes.RESET_SERVER) {
                this.onResetServerPacket(packet as IResetServerPacket);
            } else  if (packet.packetType === EPacketTypes.KEYPRESS_ON_SCREEN) {
                this.onKeypressOnScreenPacket(packet as IKeypressOnScreenPacket);
            } else if (packet.packetType === EPacketTypes.MARK_TEAM) {
                this.onMarkTeamPacket(packet as IMarkTeamPacket);
            } else if (packet.packetType === EPacketTypes.SET_BUZZER_LOCK) {
                this.onSetBuzzerLockPacket(con, packet as ISetBuzzerLockPacket);
            }
        })
    }

    private onMasterConnectionDestroy(): void {
        this.webSocketConnectionMaster = null;
        if (this.currentStateInAutomaton === EGameStates.WAITING_FOR_SETUP) {
            this.setNewState(EGameStates.WAITING_FOR_MASTER);
        } else if (this.currentStateInAutomaton === EGameStates.END) {
            this.resetServerData();
            this.setNewState(EGameStates.WAITING_FOR_MASTER);
            this.previousStateInAutomaton = null;
        } else {
            this.setNewState(EGameStates.LOST_MASTER);
        }
    }

    private setNewState(newState: EGameStates): void {
        LoggerService.log(`setting new state: ${EGameStates[newState]}`);
        this.previousStateInAutomaton = this.currentStateInAutomaton;
        this.currentStateInAutomaton = newState;
    }

    private getBuzzerConfig(): IBuzzer[] {
        if (this.buzzerConfig == null) {
            this.buzzerConfig = [];
            // check if no key was used more than once
            const keys: string[] = [];
            for (const buzzConf of config.buzzers) {
                const eKeyBind = buzzConf.key;
                if (keys.includes(eKeyBind))
                {
                    throw new Error("Cannot used the same key bind more than once");
                }
                keys.push(eKeyBind);
            }
            for (const buzzConf of config.buzzers) {
                const id: string = Uuid.v4();
                const c: IBuzzer = {
                    name: buzzConf.name,
                    id,
                    keyBind: buzzConf.key
                    // TODO remove EKeyBind
                }
                this.buzzerConfig.push(c);
                this.keyCodesInUse.push(c.keyBind);
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

        const responsePacket: IResponsePacket = {
            packetType: EPacketTypes.RESPONSE_PACKET,
            responseTo: EPacketTypes.SETUP_GAME,
            wasSuccessful: packetOk
        }

        if (packetOk) {
            this.teams = packet.teams;
            this.questions = packet.questions;
            if (packet.currentGameState != null) {
                this.currentGameState = packet.currentGameState;
            }
            this.setNewState(EGameStates.WAITING_FOR_START);
        }
        this.webSocketConnectionMaster.send<IResponsePacket>(responsePacket);

        this.sendToAllScreens<IDataForScreenPacket>(this.makeInitDataForScreen())
    }

    private onRegisterMasterPacket(con: WebSocketConnection, sub: Subscription, packet: IRegisterMasterPacket): void {
        if (this.webSocketConnectionMaster == null) {
            this.webSocketConnectionMaster = con;
            // TODO: maybe also allow EGameStates.END as state for this one?
            if (this.currentStateInAutomaton === EGameStates.WAITING_FOR_MASTER) {
                this.webSocketConnectionMaster.send<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, true));
                this.setNewState(EGameStates.WAITING_FOR_SETUP);
                this.webSocketConnectionMaster.send<IPresetupAvailableInfoPacket>({
                    packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO,
                    availableBuzzers: this.getBuzzerConfig()
                })
            } else if (this.currentStateInAutomaton === EGameStates.LOST_MASTER) {
                if (this.previousStateInAutomaton === EGameStates.WAITING_FOR_START || this.previousStateInAutomaton === EGameStates.PLAYING) {
                    this.setNewState(EGameStates.WAITING_FOR_START);
                    this.webSocketConnectionMaster.send<INewMasterAccepted>({
                        packetType: EPacketTypes.NEW_MASTER_ACCEPTED,
                        serverState: EGameStates.WAITING_FOR_START,
                        teams: this.teams,
                        questions: this.questions,
                        currentGameState: this.currentGameState
                    })
                }
            }

            this.webSocketConnectionMaster.addOnCloseCallback(this.onMasterConnectionDestroy.bind(this))
            this.webSocketConnectionMaster.addOnCloseCallback(() => sub.unsubscribe());
        } else {
            con.send<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, false));
            con.close();
            sub.unsubscribe();
        }
    }

    private onStartGamePacket(packet: IStartGamePacket): void {
        const isLegal = this.currentStateInAutomaton === EGameStates.WAITING_FOR_START;
        if (isLegal) {
            this.setNewState(EGameStates.PLAYING);
        }
        this.webSocketConnectionMaster.send<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, isLegal));
        // TODO: send to screen
    }

    private onTeamSetPointsPacket(packet: ITeamSetPointsPacket): void {
        const team: ITeam = this.findTeam(packet.teamId);
        if (team != null) {
            team.points = packet.points;
        }
        this.sendToAllScreens<ITeamSetPointsPacket>(packet);
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
        if (packet.state === EAnswerStates.ACTIVATE && !packet.answer.isCorrect) {
            this.webSocketConnectionMaster.send<IMarkTeamPacket>(PacketHelper.makeUnmarkAllTeamsPacket());
            this.sendToAllScreens<IMarkTeamPacket>(PacketHelper.makeUnmarkAllTeamsPacket());
            this.setKeypressLocked(false);
            if (this.lastKeyPressed != null) {
                // if the answer is wrong an there is a last key press, then ignore it for this round
                this.ignoredKeypresses.push(this.lastKeyPressed);
            }
        }
        this.sendToAllScreens(packet);
    }

    private onSetQuestionPacket(packet: ISetQuestionPacket): void {
        const value: number = packet.set;
        if (value >= 0 && value <= this.questions.length - 1) {
            this.currentGameState.currentQuestionNumber = value;
        }
        // this.setKeypressLocked(false);
        const lockPacket: ISetBuzzerLockPacket = PacketHelper.makeBuzzerLockPacket(false);
        this.onSetBuzzerLockPacket(null, lockPacket);
        this.ignoredKeypresses = [];
        this.sendToAllScreens(packet);
    }

    // TODO move it to some shared class/helper since it is used in the frontend as well
    private hasPreviousQuestion(): boolean {
        return this.getCurrentQuestionNumber() > 0;
    }

    // TODO move it to some shared class/helper since it is used in the frontend as well
    private hasNextQuestion(): boolean {
        return this.getCurrentQuestionNumber() < this.questions.length - 1;
    }

    // TODO move it to some shared class/helper since it is used in the frontend as well
    private getCurrentQuestionNumber(): number {
        return this.currentGameState.currentQuestionNumber;
    }

    private getCurrentQuestion(): IQuestion {
        return this.questions[this.getCurrentQuestionNumber()];
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
            questions: this.questions,
            gameState: this.currentGameState
        }
    }

    private onResetServerPacket(packet: IResetServerPacket): void {
        this.setNewState(EGameStates.WAITING_FOR_SETUP);
        this.webSocketConnectionMaster.send<IPresetupAvailableInfoPacket>({
            packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO,
            availableBuzzers: this.getBuzzerConfig()
        });
        this.resetServerData();
    }

    private resetServerData(): void {
        this.teams = [];
        this.questions = [];
        this.setKeypressLocked(false)
        this.currentGameState = {
            currentQuestionNumber: 0,
            markedTeamIds: [],
            loggedAnswers: [],
            setBuzzerLock: this.keypressLocked
        };
    }

    // TODO: create method to send to all screens AND master

    /**
     * @deprecated Will probably be removed
     */
    private onKeypressOnScreenPacket(packet: IKeypressOnScreenPacket): void {
        console.log("onKeypressOnScreenPacket", packet);
        if (packet.keyCode === config.softReleaseKey) {
            const lockPacket: ISetBuzzerLockPacket = PacketHelper.makeBuzzerLockPacket(false);
            // this.webSocketConnectionMaster.send<ISetBuzzerLockPacket>(lockPacket);
            // this.sendToAllScreens<ISetBuzzerLockPacket>(lockPacket);
            this.onSetBuzzerLockPacket(null, lockPacket, false);
        } else if (!this.isKeypressLocked() && !this.ignoredKeypresses.includes(packet.keyCode)) {
            const team: ITeam = this.getTeamForKeyCode(packet.keyCode);
            if (team == null) {
                console.log("no team found for keycode " + packet.keyCode)
                return;
            }
            this.setKeypressLocked(true);
            this.lastKeyPressed = packet.keyCode;
            const markTeamPacket: IMarkTeamPacket = PacketHelper.makeMarkTeamPacket(team.teamId, true);
            this.webSocketConnectionMaster.send<IMarkTeamPacket>(markTeamPacket);
            const buzzerLockPacket = PacketHelper.makeBuzzerLockPacket(true);
            this.webSocketConnectionMaster.send<ISetBuzzerLockPacket>(buzzerLockPacket)
            this.sendToAllScreens<IMarkTeamPacket>(markTeamPacket);
            this.sendToAllScreens<ISetBuzzerLockPacket>(buzzerLockPacket);
        }
    }

    private setKeypressLocked(locked: boolean): void {
        this.keypressLocked = locked;
    }

    private isKeypressLocked(): boolean {
        return this.keypressLocked;
    }

    private getTeamForKeyCode(keyCode: string): ITeam {
        console.log(this.keyCodesInUse)
        if (!this.keyCodesInUse.includes(keyCode)) {
            return null;
        }
        let b: IBuzzer;
        for (const buzzer of this.getBuzzerConfig()) {
            if (buzzer.keyBind === keyCode) {
                b = buzzer;
            }
        }
        console.log("found buzzer: ", b);
        if (b == null) {
            return null;
        }
        for (const team of this.teams) {
            console.log(team)
            if (b.id === team.buzzerId) {
                console.log("found team " + team.name + " to match keypress " + keyCode)

                return team;
            }
        }
        return null;
    }

    private onMarkTeamPacket(packet: IMarkTeamPacket): void {
        // we conclude that only the master can send such a package
        this.webSocketConnectionMaster.send<IMarkTeamPacket>(packet);
        this.sendToAllScreens<IMarkTeamPacket>(packet);
    }

    private validateConfig(): boolean {
        // check that buzzers are present
        if (config.buzzers == null) {
            this.configInvalidReason = "No buzzers are configured";
            return false;
        }

        // check that at least 2 buzzers are present
        if (config.buzzers.length < 2) {
            this.configInvalidReason = "Less than two buzzers are configured";
            return false;
        }

        return true;
    }

    private onSetBuzzerLockPacket(con: WebSocketConnection, packet: ISetBuzzerLockPacket, sendI2C: boolean = true): void {
        this.setKeypressLocked(packet.setLock);
        this.webSocketConnectionMaster.send<ISetBuzzerLockPacket>(packet);
        this.sendToAllScreens<ISetBuzzerLockPacket>(packet);
        // release the lock via i2c if necessary
        if (sendI2C && !packet.setLock) {
            MicroControllerI2CAdapter.releaseBuzzerLock().catch(this.handleI2CError);
        }
    }

    private startMicroControllerI2CPolling(): void {
        setInterval(this.handleMicroControllerI2CRead.bind(this), parseInt(config.i2c.pollingInMS, 10));
    }

    private async handleMicroControllerI2CRead(): Promise<void> {
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
    }

    private handleI2CError(e): void {
        console.log("I2C error occured", e);
    }

    private handlePressedBuzzer(buzzerNumber: number): void {
        const lockPacket: ISetBuzzerLockPacket =  PacketHelper.makeBuzzerLockPacket(true);
        const markTeamPacket: IMarkTeamPacket = PacketHelper.makeMarkTeamPacket(this.teams[buzzerNumber].teamId, true);
        this.webSocketConnectionMaster.send<ISetBuzzerLockPacket>(lockPacket);
        this.webSocketConnectionMaster.send<IMarkTeamPacket>(markTeamPacket);
        this.sendToAllScreens<ISetBuzzerLockPacket>(lockPacket);
        this.sendToAllScreens<IMarkTeamPacket>(markTeamPacket);
    }

    private handleIdleSituation(): void {
        const lockPacket: ISetBuzzerLockPacket =  PacketHelper.makeBuzzerLockPacket(false);
        const markTeamPacket: IMarkTeamPacket = PacketHelper.makeUnmarkAllTeamsPacket();
        this.webSocketConnectionMaster.send<ISetBuzzerLockPacket>(lockPacket);
        this.webSocketConnectionMaster.send<IMarkTeamPacket>(markTeamPacket);
        this.sendToAllScreens<ISetBuzzerLockPacket>(lockPacket);
        this.sendToAllScreens<IMarkTeamPacket>(markTeamPacket);
    }
}
