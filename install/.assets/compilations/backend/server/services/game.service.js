"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const web_socket_service_1 = require("./web-socket.service");
const shared_1 = require("../../shared/shared");
const config_json_1 = __importDefault(require("../../config.json"));
const Uuid = __importStar(require("uuid"));
const logger_service_1 = require("./logger.service");
// import {MicroControllerI2CAdapter} from "../objects/adapters/MicroControllerI2C.adapter";
class GameService {
    constructor() {
        this.keypressLocked = false;
        this.keyCodesInUse = [];
        this.ignoredKeypresses = [];
        if (!this.validateConfig()) {
            throw new Error(this.configInvalidReason);
        }
        this.webSocketConnectionsScreens = new Map();
        this.newConnectionEstablished$ = web_socket_service_1.WebSocketService.get().start();
        this.newConnectionEstablishedSubscription = this.newConnectionEstablished$.subscribe(this.onNewConnection.bind(this));
        // When this is instantiated, the game is looking for a master
        this.setNewState(shared_1.EGameStates.WAITING_FOR_MASTER);
        // call this once to read config and create necessary variables
        this.getBuzzerConfig();
        // this.startMicroControllerI2CPolling();
    }
    static get() {
        if (this.instance == null) {
            this.instance = new GameService();
        }
        return this.instance;
    }
    static startGame() {
        // starts the game by instantiating is
        this.get();
    }
    onNewConnection(con) {
        console.dir("new connection");
        // wait until the first packet to determine whether it is a master or a screen
        const sub = con.onMessage().subscribe((packet) => {
            // the "sub" will be unsubscribed in the onRegisterMasterPacket
            if (packet.packetType === shared_1.EPacketTypes.REGISTER_MASTER) {
                this.onRegisterMasterPacket(con, sub, packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.SETUP_GAME) {
                this.onSetupGamePackage(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.START_GAME) {
                this.onStartGamePacket(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.TEAM_SET_POINTS) {
                this.onTeamSetPointsPacket(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.ANSWER_SET_STATE) {
                this.onAnswerSetStatePacket(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.SET_QUESTION) {
                this.onSetQuestionPacket(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.END_GAME) {
                this.onEndGamePacket(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.REGISTER_SCREEN) {
                this.onRegisterScreenPacket(con, sub, packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.RESET_SERVER) {
                this.onResetServerPacket(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.KEYPRESS_ON_SCREEN) {
                this.onKeypressOnScreenPacket(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.MARK_TEAM) {
                this.onMarkTeamPacket(packet);
            }
            else if (packet.packetType === shared_1.EPacketTypes.SET_BUZZER_LOCK) {
                this.onSetBuzzerLockPacket(con, packet);
            }
        });
    }
    onMasterConnectionDestroy() {
        logger_service_1.LoggerService.log('Connection to master was closed');
        this.webSocketConnectionMaster = null;
        if (this.currentStateInAutomaton === shared_1.EGameStates.WAITING_FOR_SETUP) {
            this.setNewState(shared_1.EGameStates.WAITING_FOR_MASTER);
        }
        else if (this.currentStateInAutomaton === shared_1.EGameStates.END) {
            this.resetServerData();
            this.setNewState(shared_1.EGameStates.WAITING_FOR_MASTER);
            this.previousStateInAutomaton = null;
        }
        else {
            this.setNewState(shared_1.EGameStates.LOST_MASTER);
        }
    }
    setNewState(newState) {
        logger_service_1.LoggerService.log(`setting new state: ${shared_1.EGameStates[newState]}`);
        this.previousStateInAutomaton = this.currentStateInAutomaton;
        this.currentStateInAutomaton = newState;
    }
    getBuzzerConfig() {
        if (this.buzzerConfig == null) {
            this.buzzerConfig = [];
            // check if no key was used more than once
            const keys = [];
            for (const buzzConf of config_json_1.default.buzzers) {
                const eKeyBind = buzzConf.key;
                if (keys.includes(eKeyBind)) {
                    throw new Error("Cannot used the same key bind more than once");
                }
                keys.push(eKeyBind);
            }
            for (const buzzConf of config_json_1.default.buzzers) {
                const id = Uuid.v4();
                const c = {
                    name: buzzConf.name,
                    id,
                    keyBind: buzzConf.key
                    // TODO remove EKeyBind
                };
                this.buzzerConfig.push(c);
                this.keyCodesInUse.push(c.keyBind);
            }
        }
        return this.buzzerConfig;
    }
    onSetupGamePackage(packet) {
        if (this.currentStateInAutomaton !== shared_1.EGameStates.WAITING_FOR_SETUP) {
            return;
        }
        let packetOk = true;
        // check if at least two teams are defined
        if (packet.teams.length < 2) {
            packetOk = false;
        }
        const responsePacket = {
            packetType: shared_1.EPacketTypes.RESPONSE_PACKET,
            responseTo: shared_1.EPacketTypes.SETUP_GAME,
            wasSuccessful: packetOk
        };
        if (packetOk) {
            this.teams = packet.teams;
            this.questions = packet.questions;
            if (packet.currentGameState != null) {
                this.currentGameState = packet.currentGameState;
            }
            this.setNewState(shared_1.EGameStates.WAITING_FOR_START);
        }
        this.webSocketConnectionMaster.send(responsePacket);
        this.sendToAllScreens(this.makeInitDataForScreen());
        console.log("current game state", this.currentGameState, packet.currentGameState);
    }
    onRegisterMasterPacket(con, sub, packet) {
        if (this.webSocketConnectionMaster == null) {
            this.webSocketConnectionMaster = con;
            // TODO: maybe also allow EGameStates.END as state for this one?
            if (this.currentStateInAutomaton === shared_1.EGameStates.WAITING_FOR_MASTER) {
                this.webSocketConnectionMaster.send(shared_1.PacketHelper.makeResponsePacket(packet.packetType, true));
                this.setNewState(shared_1.EGameStates.WAITING_FOR_SETUP);
                this.webSocketConnectionMaster.send({
                    packetType: shared_1.EPacketTypes.PRESETUP_AVAILABLE_INFO,
                    availableBuzzers: this.getBuzzerConfig()
                });
            }
            else if (this.currentStateInAutomaton === shared_1.EGameStates.LOST_MASTER) {
                if (this.previousStateInAutomaton === shared_1.EGameStates.WAITING_FOR_START || this.previousStateInAutomaton === shared_1.EGameStates.PLAYING) {
                    this.setNewState(shared_1.EGameStates.WAITING_FOR_START);
                    this.webSocketConnectionMaster.send({
                        packetType: shared_1.EPacketTypes.NEW_MASTER_ACCEPTED,
                        serverState: shared_1.EGameStates.WAITING_FOR_START,
                        teams: this.teams,
                        questions: this.questions,
                        currentGameState: this.currentGameState
                    });
                }
            }
            this.webSocketConnectionMaster.addOnCloseCallback(this.onMasterConnectionDestroy.bind(this));
            this.webSocketConnectionMaster.addOnCloseCallback(() => sub.unsubscribe());
        }
        else {
            con.send(shared_1.PacketHelper.makeResponsePacket(packet.packetType, false));
            con.close();
            sub.unsubscribe();
        }
    }
    onStartGamePacket(packet) {
        const isLegal = this.currentStateInAutomaton === shared_1.EGameStates.WAITING_FOR_START;
        if (isLegal) {
            this.setNewState(shared_1.EGameStates.PLAYING);
        }
        this.webSocketConnectionMaster.send(shared_1.PacketHelper.makeResponsePacket(packet.packetType, isLegal));
        // TODO: send to screen
    }
    onTeamSetPointsPacket(packet) {
        const team = this.findTeam(packet.teamId);
        if (team != null) {
            team.points = packet.points;
        }
        this.sendToAllScreens(packet);
    }
    // TODO move to some shared resource
    findTeam(teamId) {
        for (const team of this.teams) {
            if (teamId === team.teamId) {
                return team;
            }
        }
    }
    onAnswerSetStatePacket(packet) {
        if (packet.state === shared_1.EAnswerStates.ACTIVATE) {
            const p = shared_1.PacketHelper.makeUnmarkAllTeamsPacket();
            this.webSocketConnectionMaster.send(p);
            this.sendToAllScreens(p);
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
    onSetQuestionPacket(packet) {
        const value = packet.set;
        if (value >= 0 && value <= this.questions.length - 1) {
            this.currentGameState.currentQuestionNumber = value;
        }
        // this.setKeypressLocked(false);
        const lockPacket = shared_1.PacketHelper.makeBuzzerLockPacket(false);
        this.onSetBuzzerLockPacket(null, lockPacket);
        this.ignoredKeypresses = [];
        this.sendToAllScreens(packet);
    }
    // TODO move it to some shared class/helper since it is used in the frontend as well
    hasPreviousQuestion() {
        return this.getCurrentQuestionNumber() > 0;
    }
    // TODO move it to some shared class/helper since it is used in the frontend as well
    hasNextQuestion() {
        return this.getCurrentQuestionNumber() < this.questions.length - 1;
    }
    // TODO move it to some shared class/helper since it is used in the frontend as well
    getCurrentQuestionNumber() {
        return this.currentGameState.currentQuestionNumber;
    }
    getCurrentQuestion() {
        return this.questions[this.getCurrentQuestionNumber()];
    }
    getIdOfAnswer(answer) {
        const answers = this.getCurrentQuestion().answers;
        for (let i = 0; i < answers.length; i++) {
            if (answers[i] === answer) {
                return i;
            }
        }
        // if the answer was not found in the current question, return some number less than zero
        return -1;
    }
    onEndGamePacket(packet) {
        this.setNewState(shared_1.EGameStates.END);
        this.sendToAllScreens(packet);
    }
    onRegisterScreenPacket(con, sub, packet) {
        this.webSocketConnectionsScreens.set(packet.screenId, con);
        if (this.currentStateInAutomaton === shared_1.EGameStates.WAITING_FOR_START || this.currentStateInAutomaton === shared_1.EGameStates.LOST_MASTER || this.currentStateInAutomaton === shared_1.EGameStates.PLAYING) {
            con.send(this.makeInitDataForScreen());
        }
        con.addOnCloseCallback(() => {
            con.close();
            sub.unsubscribe();
            this.webSocketConnectionsScreens.delete(packet.screenId);
        });
    }
    sendToAllScreens(packet) {
        this.webSocketConnectionsScreens.forEach((con) => {
            con.send(packet);
        });
    }
    makeInitDataForScreen() {
        return {
            packetType: shared_1.EPacketTypes.DATA_FOR_SCREEN,
            teams: this.teams,
            questions: this.questions,
            gameState: this.currentGameState
        };
    }
    onResetServerPacket(packet) {
        this.setNewState(shared_1.EGameStates.WAITING_FOR_SETUP);
        this.webSocketConnectionMaster.send({
            packetType: shared_1.EPacketTypes.PRESETUP_AVAILABLE_INFO,
            availableBuzzers: this.getBuzzerConfig()
        });
        this.sendToAllScreens(packet);
        this.resetServerData();
    }
    resetServerData() {
        this.teams = [];
        this.questions = [];
        this.setKeypressLocked(false);
        this.releaseHardwareBuzzerLock(true);
        this.ignoredKeypresses = [];
        this.lastKeyPressed = null;
        this.currentGameState = {
            currentQuestionNumber: 0,
            markedTeamIds: [],
            loggedAnswers: [],
            setBuzzerLock: this.keypressLocked
        };
    }
    // TODO: create method to send to all screens AND master
    onKeypressOnScreenPacket(packet) {
        if (packet.keyCode === config_json_1.default.softReleaseKey) {
            this.releaseHardwareBuzzerLock();
            const unmarkTeamsPacket = shared_1.PacketHelper.makeUnmarkAllTeamsPacket();
            this.webSocketConnectionMaster.send(unmarkTeamsPacket);
            this.sendToAllScreens(unmarkTeamsPacket);
        }
        else if (!this.isKeypressLocked() && !this.ignoredKeypresses.includes(packet.keyCode)) {
            const team = this.getTeamForKeyCode(packet.keyCode);
            if (team == null) {
                logger_service_1.LoggerService.log("no team found for keycode " + packet.keyCode);
                return;
            }
            this.setKeypressLocked(true);
            this.lastKeyPressed = packet.keyCode;
            const markTeamPacket = shared_1.PacketHelper.makeMarkTeamPacket(team.teamId, true);
            this.webSocketConnectionMaster.send(markTeamPacket);
            const buzzerLockPacket = shared_1.PacketHelper.makeBuzzerLockPacket(true);
            this.webSocketConnectionMaster.send(buzzerLockPacket);
            this.sendToAllScreens(markTeamPacket);
            this.sendToAllScreens(buzzerLockPacket);
        }
    }
    releaseHardwareBuzzerLock(sendI2C = false) {
        const lockPacket = shared_1.PacketHelper.makeBuzzerLockPacket(false);
        this.onSetBuzzerLockPacket(null, lockPacket, sendI2C);
    }
    setKeypressLocked(locked) {
        this.keypressLocked = locked;
    }
    isKeypressLocked() {
        return this.keypressLocked;
    }
    getTeamForKeyCode(keyCode) {
        if (!this.keyCodesInUse.includes(keyCode)) {
            return null;
        }
        let b;
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
                logger_service_1.LoggerService.log("found team " + team.name + " to match keypress " + keyCode);
                return team;
            }
        }
        return null;
    }
    onMarkTeamPacket(packet) {
        // we conclude that only the master can send such a package
        this.webSocketConnectionMaster.send(packet);
        this.sendToAllScreens(packet);
    }
    validateConfig() {
        // check that buzzers are present
        if (config_json_1.default.buzzers == null) {
            this.configInvalidReason = "No buzzers are configured";
            return false;
        }
        // check that at least 2 buzzers are present
        if (config_json_1.default.buzzers.length < 2) {
            this.configInvalidReason = "Less than two buzzers are configured";
            return false;
        }
        return true;
    }
    onSetBuzzerLockPacket(con, packet, sendI2C = true) {
        this.setKeypressLocked(packet.setLock);
        // it is very likely, that the master already reloaded the page, thus this is null
        if (this.webSocketConnectionMaster != null) {
            this.webSocketConnectionMaster.send(packet);
        }
        this.sendToAllScreens(packet);
        // release the lock via i2c if necessary
        if (sendI2C && !packet.setLock) {
            // MicroControllerI2CAdapter.releaseBuzzerLock().catch(this.handleI2CError);
        }
    }
    startMicroControllerI2CPolling() {
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
    handleI2CError(e) {
        console.log("I2C error occured", e);
    }
    handlePressedBuzzer(buzzerNumber) {
        const lockPacket = shared_1.PacketHelper.makeBuzzerLockPacket(true);
        const markTeamPacket = shared_1.PacketHelper.makeMarkTeamPacket(this.teams[buzzerNumber].teamId, true);
        this.webSocketConnectionMaster.send(lockPacket);
        this.webSocketConnectionMaster.send(markTeamPacket);
        this.sendToAllScreens(lockPacket);
        this.sendToAllScreens(markTeamPacket);
    }
    handleIdleSituation() {
        const lockPacket = shared_1.PacketHelper.makeBuzzerLockPacket(false);
        const markTeamPacket = shared_1.PacketHelper.makeUnmarkAllTeamsPacket();
        this.webSocketConnectionMaster.send(lockPacket);
        this.webSocketConnectionMaster.send(markTeamPacket);
        this.sendToAllScreens(lockPacket);
        this.sendToAllScreens(markTeamPacket);
    }
}
exports.GameService = GameService;
//# sourceMappingURL=game.service.js.map