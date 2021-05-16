import {WebSocketConnection} from "../objects/web-socket-connection";
import {WebSocketService} from "./web-socket.service";
import {Observable, Subscription} from "rxjs";
import {EGameStates, EPacketTypes, IPresetupAvailableInfoPacket, IGamePacket, IResponsePacket, IBuzzer, EKeyBinds} from "../../shared/objects/shared";
import config from '../../config.json';
import * as Uuid from 'uuid';

export class GameService {
    private static instance: GameService;
    private webSocketConnectionMaster: WebSocketConnection;
    private webSocketConnectionsScreens: Map<string, WebSocketConnection>;
    private newConnectionEstablished$: Observable<WebSocketConnection>;
    private newConnectionEstablishedSubscription: Subscription;
    private newMessageMasterSubscription: Subscription;
    private currentState: EGameStates;
    private previousState: EGameStates;
    private buzzerConfig: IBuzzer[];

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
        let  sub = con.onMessage().subscribe((packet: IGamePacket) => {
            if (packet.packetType == EPacketTypes.REGISTER_MASTER) {
                const getResponsePacket: (boolean) => IResponsePacket = b => {
                    return {
                        packetType: EPacketTypes.RESPONSE_PACKET,
                        responseTo: EPacketTypes.REGISTER_MASTER,
                        wasSuccessful: b,
                    };
                };

                if (this.webSocketConnectionMaster == null && this.currentState == EGameStates.WAITING_FOR_MASTER) {
                    this.webSocketConnectionMaster = con;
                    this.webSocketConnectionMaster.send<IResponsePacket>(getResponsePacket(true));
                    this.setNewState(EGameStates.WAITING_FOR_SETUP);
                    this.webSocketConnectionMaster.send<IPresetupAvailableInfoPacket>({
                        packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO,
                        availableBuzzers: this.getBuzzerConfig()
                    })
                    this.webSocketConnectionMaster.addOnCloseCallback(this.onMasterConnectionDestroy.bind(this))
                } else {
                    con.send<IResponsePacket>(getResponsePacket(false));
                    con.close();
                }
            }
        })
    }

    private onMasterConnectionDestroy(): void {
        console.log("SJKHJKADJNDSAHDHNS")
        this.webSocketConnectionMaster = null;
        this.setNewState(EGameStates.WAITING_FOR_MASTER);
    }

    private setNewState(newState: EGameStates): void {
        this.previousState = this.currentState;
        this.currentState = newState;
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
}
