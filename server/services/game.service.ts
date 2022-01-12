import {WebSocketConnection} from "../objects/web-socket-connection";
import {WebSocketService} from "./web-socket.service";
import {Observable, Subscription} from "rxjs";
import {
    EAnswerStates,
    EGameStates,
    EPacketTypes,
    EVideoStates,
    IAnswer,
    IAnswerSetStatePacket,
    IBuzzer,
    IDataForScreenPacket,
    IEndGamePacket,
    IGamePacket,
    IGameState,
    IKeypressOnScreenPacket,
    IMarkTeamPacket,
    INewMasterAccepted,
    IPresetupAvailableInfoPacket,
    IQuestion,
    IRegisterMasterPacket,
    IRegisterScreenPacket,
    IResetServerPacket,
    IResponsePacket,
    ISetBuzzerLockPacket,
    ISetQuestionPacket,
    ISetupPacket,
    IStartGamePacket,
    ITeam,
    ITeamSetPointsPacket,
    IUpdateMediaStatePacket,
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

enum LOOKUP_TEAM_CODE {
    BY_KEYPRESS,
    BY_BYTE
}

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
        this.newConnectionEstablished$ = WebSocketService.get().start();
        this.newConnectionEstablishedSubscription = this.newConnectionEstablished$.subscribe(this.onNewConnection.bind(this))
        // When this is instantiated, the game is looking for a master
        this.setNewState(EGameStates.WAITING_FOR_MASTER);
        // call this once to read config and create necessary variables
        this.getBuzzerConfig();
        SerialPortService.get().addOnDataInCallback(this.onSerialDataIn.bind(this));
        SerialPortService.get().addOnErrorCallback(this.onSerialError.bind(this));
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
            } else if (packet.packetType === EPacketTypes.UPDATE_MEDIA_STATE) {
                this.onUpdateMediaStatePacket(packet as IUpdateMediaStatePacket);
            }
        })
    }

    private onMasterConnectionDestroy(): void {
        LoggerService.log('Connection to master was closed');
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
                    keyBind: buzzConf.key,
                    byteBind: buzzConf.byte.toString(10)
                    // TODO remove EKeyBind
                }
                this.buzzerConfig.push(c);
                this.keyOrByteCodesInUse.push(c.byteBind);
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
        console.log("current game state", this.currentGameState, packet.currentGameState);
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
        if (packet.state === EAnswerStates.ACTIVATE) {
            const p = PacketHelper.makeUnmarkAllTeamsPacket();
            this.webSocketConnectionMaster.send<IMarkTeamPacket>(p);
            this.sendToAllScreens<IMarkTeamPacket>(p);
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
        const value: number = packet.set;
        if (value >= 0 && value <= this.questions.length - 1) {
            this.currentGameState.currentQuestionNumber = value;
        }
        // this.setKeypressLocked(false);
        const lockPacket: ISetBuzzerLockPacket = PacketHelper.makeBuzzerLockPacket(false);
        this.onSetBuzzerLockPacket(null, lockPacket);
        this.ignoredKeypresses = [];
        this.sendToAllScreens(packet);
        const mediaPacket: IUpdateMediaStatePacket = PacketHelper.makeMediaStatePacket(EVideoStates.STOPPED, undefined);
        this.onUpdateMediaStatePacket(mediaPacket);
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
        this.sendToAllScreens(packet);
        this.resetServerData();
    }

    private resetServerData(): void {
        this.teams = [];
        this.questions = [];
        this.setKeypressLocked(false)
        this.releaseHardwareBuzzerLock(true);
        this.ignoredKeypresses = [];
        this.lastKeyPressed = null;
        this.currentGameState = {
            mediaState: EVideoStates.NO_VIDEO,
            currentQuestionNumber: 0,
            markedTeamIds: [],
            loggedAnswers: [],
            setBuzzerLock: this.keypressLocked
        };
    }

    // TODO: create method to send to all screens AND master
    private onKeypressOnScreenPacket(packet: IKeypressOnScreenPacket): void {
        if (packet.keyCode === config.softReleaseKey) {
            this.releaseHardwareBuzzerLock(true);
            const unmarkTeamsPacket: IMarkTeamPacket = PacketHelper.makeUnmarkAllTeamsPacket();
            this.webSocketConnectionMaster.send<IMarkTeamPacket>(unmarkTeamsPacket);
            this.sendToAllScreens<IMarkTeamPacket>(unmarkTeamsPacket);
        } else if (!this.isKeypressLocked() && !this.ignoredKeypresses.includes(packet.keyCode)) {
            const team: ITeam = this.getTeamForKeyPressCode(packet.keyCode);
            if (team == null) {
                LoggerService.log("no team found for keycode " + packet.keyCode)
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
        console.log("keycodes", this.keyOrByteCodesInUse, code)
        if (!this.keyOrByteCodesInUse.includes(code)) {
            return null;
        }
        let b: IBuzzer;
        for (const buzzer of this.getBuzzerConfig()) {
            console.log("buzzer", buzzer)
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
            console.log("b null")
            return null;
        }
        for (const team of this.teams) {
            console.log("team", b.id, team.buzzerId)
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

    private onSetBuzzerLockPacket(con: WebSocketConnection, packet: ISetBuzzerLockPacket, sendSerial: boolean = true): void {
        this.setKeypressLocked(packet.setLock);
        // it is very likely, that the master already reloaded the page, thus this is null
        if (this.webSocketConnectionMaster != null) {
            this.webSocketConnectionMaster.send<ISetBuzzerLockPacket>(packet);
        }
        this.sendToAllScreens<ISetBuzzerLockPacket>(packet);
        // release the lock via i2c if necessary
        if (sendSerial && !packet.setLock) {
            // MicroControllerI2CAdapter.releaseBuzzerLock().catch(this.handleI2CError);
            MicroControllerSerialAdapter.sendSerialCommandReleaseLock();
        }
    }

    private onUpdateMediaStatePacket(packet: IUpdateMediaStatePacket): void {
        if (this.webSocketConnectionMaster != null) {
            this.webSocketConnectionMaster.send<IUpdateMediaStatePacket>(packet);
        }
        this.sendToAllScreens<IUpdateMediaStatePacket>(packet);
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

    private onSerialDataIn(data: Buffer): void {
        console.log("got new data on serial: ", data);
        const c: typeof config = ConfigService.get();
        const input: number = toInteger(data.toString('hex'));
        console.log("inputnumber", input);
        if (input === c.softReleaseByte) {
            const unmarkTeamsPacket: IMarkTeamPacket = PacketHelper.makeUnmarkAllTeamsPacket();
            this.webSocketConnectionMaster.send<IMarkTeamPacket>(unmarkTeamsPacket);
            this.sendToAllScreens<IMarkTeamPacket>(unmarkTeamsPacket);
            this.setKeypressLocked(false);
            this.releaseHardwareBuzzerLock(false);
        } else {
            const inputAsString = input.toString(10);
            console.log("inputAsString", inputAsString);
            if (!this.isKeypressLocked() && !this.ignoredKeypresses.includes(inputAsString)) {
                const team: ITeam = this.getTeamForByteCode(inputAsString);
                if (team == null) {
                    LoggerService.error("no team found for byte code " + inputAsString)
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
        this.webSocketConnectionMaster.send<IMarkTeamPacket>(markTeamPacket);
        const buzzerLockPacket = PacketHelper.makeBuzzerLockPacket(true);
        this.webSocketConnectionMaster.send<ISetBuzzerLockPacket>(buzzerLockPacket)
        const mediaStateUpdatePacket = PacketHelper.makeMediaStatePacket(EVideoStates.STOPPED, undefined);
        this.onUpdateMediaStatePacket(mediaStateUpdatePacket);
        this.sendToAllScreens<IMarkTeamPacket>(markTeamPacket);
        this.sendToAllScreens<ISetBuzzerLockPacket>(buzzerLockPacket);
    }

    private onSerialError(err): void {
        // TODO
    }
}
