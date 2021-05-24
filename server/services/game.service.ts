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
    ITeamSetPointsPacket
} from "../../shared/objects/shared";
import config from '../../config.json';
import * as Uuid from 'uuid';
import {LoggerService} from "./logger.service";
import {PacketHelper} from "../helpers/packet.helper";

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

    private constructor() {
        this.webSocketConnectionsScreens = new Map<string, WebSocketConnection>();
        this.newConnectionEstablished$ = WebSocketService.get().start();
        this.newConnectionEstablishedSubscription = this.newConnectionEstablished$.subscribe(this.onNewConnection.bind(this))
        // When this is instantiated, the game is looking for a master
        this.setNewState(EGameStates.WAITING_FOR_MASTER);
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
            if (packet.packetType == EPacketTypes.REGISTER_MASTER) {
                this.onRegisterMasterPacket(con, sub, packet as IRegisterMasterPacket);
            } else if (packet.packetType == EPacketTypes.SETUP_GAME) {
                this.onSetupGamePackage(packet as ISetupPacket);
            } else if (packet.packetType === EPacketTypes.START_GAME) {
                this.onStartGamePacket(packet as IStartGamePacket);
            } else if (packet.packetType === EPacketTypes.TEAM_SET_POINTS) {
                this.onTeamSetPointsPacket(packet as ITeamSetPointsPacket);
            }
        })
    }

    private onMasterConnectionDestroy(): void {
        this.webSocketConnectionMaster = null;
        if (this.currentStateInAutomaton == EGameStates.WAITING_FOR_SETUP) {
            this.setNewState(EGameStates.WAITING_FOR_MASTER);
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
            let keys: EKeyBinds[] = [];
            for (let buzzConf of config.buzzers) {
                let eKeyBind = EKeyBinds[buzzConf.key];
                if (keys.includes(eKeyBind))
                {
                    throw new Error("Cannot used the same key bind more than once");
                }
                keys.push(eKeyBind);
            }
            for (let buzzConf of config.buzzers) {
                let id: string = Uuid.v4();
                let c: IBuzzer = {
                    name: buzzConf.name,
                    id: id,
                    keyBind: EKeyBinds[buzzConf.key]
                }
                this.buzzerConfig.push(c);
            }
        }
        return this.buzzerConfig;
    }

    private onSetupGamePackage(packet: ISetupPacket): void {
        if (this.currentStateInAutomaton != EGameStates.WAITING_FOR_SETUP) {
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
            this.setNewState(EGameStates.WAITING_FOR_START);
        }
        this.webSocketConnectionMaster.send<IResponsePacket>(responsePacket);
    }

    private onRegisterMasterPacket(con: WebSocketConnection, sub: Subscription, packet: IRegisterMasterPacket): void {
        if (this.webSocketConnectionMaster == null) {
            this.webSocketConnectionMaster = con;
            if (this.currentStateInAutomaton == EGameStates.WAITING_FOR_MASTER) {
                this.webSocketConnectionMaster.send<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, true));
                this.setNewState(EGameStates.WAITING_FOR_SETUP);
                this.webSocketConnectionMaster.send<IPresetupAvailableInfoPacket>({
                    packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO,
                    availableBuzzers: this.getBuzzerConfig()
                })
            } else if (this.currentStateInAutomaton == EGameStates.LOST_MASTER) {
                if (this.previousStateInAutomaton === EGameStates.WAITING_FOR_START || this.previousStateInAutomaton === EGameStates.PLAYING) {
                    this.setNewState(EGameStates.WAITING_FOR_START);
                    this.webSocketConnectionMaster.send<INewMasterAccepted>({
                        packetType: EPacketTypes.NEW_MASTER_ACCEPTED,
                        serverState: EGameStates.WAITING_FOR_START,
                        teams: this.teams,
                        questions: this.questions
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
        let isLegal = this.currentStateInAutomaton === EGameStates.WAITING_FOR_START;
        if (isLegal) {
            this.setNewState(EGameStates.PLAYING);
        }
        this.webSocketConnectionMaster.send<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, isLegal));
    }

    private onTeamSetPointsPacket(packet: ITeamSetPointsPacket): void {
        const team: ITeam = this.findTeam(packet.teamId);
        if (team != null) {
            team.points = packet.points;
        }
    }

    private findTeam(teamId: string): ITeam {
        for (const team of this.teams) {
            if (teamId === team.teamId) {
                return team;
            }
        }
    }
}
