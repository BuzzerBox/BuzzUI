import {WebSocketConnection} from "../objects/web-socket-connection";
import {WebSocketService} from "./web-socket.service";
import {Observable, Subscription} from "rxjs";
import {
    EAnswerStates,
    EGameStates,
    EGradeResults,
    GameStateHelper,
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
    IRegisterMasterPacket,
    IRegisterScreenPacket,
    IResetServerPacket,
    IResponsePacket,
    ISetBuzzerLockPacket,
    ISetMediaVolumePacket,
    ISetQuestionPacket,
    ISetupPacket,
    IStartGamePacket,
    IStorageAccessPacket,
    IMasterTakenOverPacket,
    IAutosaveInfoPacket,
    IAvailableBuzzersPacket,
    IUsbBuzzersPacket,
    IAdoptUsbBuzzerPacket,
    IBoxSettingsPacket,
    ISaveBoxSettingsPacket,
    IAddSshKeyPacket,
    IRemoveSshKeyPacket,
    ISetLanguagePacket,
    ISetActiveExtensionPacket,
    ITeam,
    ITeamSetPointsPacket,
    IUpdateInfoPacket,
    IUpdateMediaStatePacket,
    IUpdateTeamsPacket,
    BuzzerHelper,
    LanguageHelper,
    TLanguage,
    PacketHelper,
    ScoringHelper,
    PacketTypeHelper
} from "../../shared/shared";
import * as Uuid from 'uuid';
import {LoggerService} from './logger.service';
import {IUdpBuzzerState, UdpBuzzerService} from './udp-buzzer.service';
import {BuzzerProvisioningService} from './buzzer-provisioning.service';
import {BoxSettingsService} from './box-settings.service';
import {ConfigService} from './config.service';
import {ObjectHelper} from '../../shared/helper/object.helper';
import {UpdateService} from './update.service';
import {StorageService} from './storage.service';
import {AutosaveService} from './autosave.service';
import {ClockService} from './clock.service';
import {IExtensionHost, IServerExtension, TExtensionPacketHandler} from '../extensions/server-extension';

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
    // the buzzers of the box, from the config, see getBoxBuzzers()
    private boxBuzzers: IBuzzer[];
    // whether an extension presses them, see IExtensionHost.enableBoxBuzzers()
    private areBoxBuzzersEnabledByExtension = false;
    private readonly lockReleasedCallbacks: ((origin: string | undefined) => void)[] = [];
    private readonly extensionPacketHandlers = new Map<number, {handler: TExtensionPacketHandler, isFromAnyConnection: boolean}>();
    private teams: ITeam[] = [];
    private questions: IQuestion[] = [];
    private currentGameState: IGameState;
    private keypressLocked = false;
    // whether the master that rejoined left a game that was already running, so starting it again continues it
    private resumesRunningGame = false;
    // whether the game was ended, for its saved state
    private gameFinished = false;
    // buzzers whose presses don't count in this question (not used yet, see onAnswerSetStatePacket)
    private ignoredBuzzerIds: string[] = [];
    private lastBuzzerIdPressed: string;
    private configInvalidReason: string;
    // what the master chose, which the screens follow; unknown until a master registered, and kept across games
    private language: TLanguage | undefined;
    // the extensions that started, see startExtensions()
    private readonly startedExtensionIds = new Set<string>();
    // the extension whose mode is on, which the master and the screens follow, or null for the quiz
    private activeExtensionId: string | null = null;

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
        // their IDs stay the same while the server runs
        this.getBoxBuzzers();
        UdpBuzzerService.get().setStateProvider(this.getUdpBuzzerState.bind(this));
        UdpBuzzerService.get().addOnPressCallback(this.pressBuzzers.bind(this));
        UdpBuzzerService.get().addOnBuzzersChangedCallback(() => {
            // a buzzer that got another color shows its team in it
            if (this.applyBuzzerColors(this.teams)) {
                const updateTeamsPacket: IUpdateTeamsPacket = {packetType: EPacketTypes.UPDATE_TEAMS, teams: this.teams};
                this.sendToMaster<IUpdateTeamsPacket>(updateTeamsPacket);
                this.sendToAllScreens<IUpdateTeamsPacket>(updateTeamsPacket);
                if (this.isGameSetUp()) {
                    AutosaveService.get().changed();
                }
            }
            this.sendToMaster<IAvailableBuzzersPacket>({
                packetType: EPacketTypes.AVAILABLE_BUZZERS,
                availableBuzzers: this.getAvailableBuzzers()
            });
            // a buzzer plugged in over USB shows whether it is connected
            this.sendToMaster<IUsbBuzzersPacket>({
                packetType: EPacketTypes.USB_BUZZERS,
                buzzers: BuzzerProvisioningService.get().getBuzzers()
            });
        });
        BuzzerProvisioningService.get().addOnChangedCallback(buzzers => this.sendToMaster<IUsbBuzzersPacket>({
            packetType: EPacketTypes.USB_BUZZERS,
            buzzers
        }));
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

    /**
     * Starts the extensions, see IServerExtension. One that fails to start is left out; the game runs without it.
     */
    public startExtensions(extensions: IServerExtension[]): void {
        for (const extension of extensions) {
            try {
                extension.start(this.makeExtensionHost());
                this.startedExtensionIds.add(extension.id);
                LoggerService.log(`Started the extension ${extension.id}`);
            } catch (e) {
                LoggerService.error(`Could not start the extension ${extension.id}`, e);
            }
        }
    }

    private makeExtensionHost(): IExtensionHost {
        return {
            getBoxBuzzers: () => this.getBoxBuzzers(),
            enableBoxBuzzers: () => {
                this.areBoxBuzzersEnabledByExtension = true;
            },
            pressBuzzer: buzzerId => this.pressBuzzers([buzzerId]),
            releaseFromBox: extensionId => this.releaseFromBox(extensionId),
            onLockReleased: callback => {
                this.lockReleasedCallbacks.push(callback);
            },
            getBoxSetting: key => BoxSettingsService.get().getAppliedSetting(key),
            registerPacketHandler: (packetType, handler, options) => {
                if (!PacketTypeHelper.isExtensionPacketType(packetType)) {
                    throw new Error(`Packet type ${packetType} is the core's; an extension's start at ${PacketTypeHelper.FIRST_EXTENSION_PACKET_TYPE}`);
                }
                if (this.extensionPacketHandlers.has(packetType)) {
                    throw new Error(`Packet type ${packetType} has a handler already`);
                }
                this.extensionPacketHandlers.set(packetType, {handler, isFromAnyConnection: !!options?.isFromAnyConnection});
            },
            sendToMaster: packet => this.sendToMaster(packet),
            sendToAllScreens: packet => this.sendToAllScreens(packet),
            isGameRunning: () => this.isGameRunning(),
            getActiveExtension: () => this.activeExtensionId
        };
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
        if (PacketTypeHelper.isExtensionPacketType(packet.packetType)) {
            this.onExtensionPacket(con, packet);
            return;
        }
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
        } else if (packet.packetType === EPacketTypes.ADOPT_USB_BUZZER) {
            const adoptPacket = packet as IAdoptUsbBuzzerPacket;
            BuzzerProvisioningService.get().adopt(adoptPacket.path, adoptPacket.color);
        } else if (packet.packetType === EPacketTypes.REQUEST_BOX_SETTINGS) {
            this.sendBoxSettings().catch(e => LoggerService.error('Could not send the box\'s settings', e));
        } else if (packet.packetType === EPacketTypes.SAVE_BOX_SETTINGS) {
            this.answerFailure(packet, this.onSaveBoxSettingsPacket(packet as ISaveBoxSettingsPacket));
        } else if (packet.packetType === EPacketTypes.RESTART_BOX) {
            this.answerFailure(packet, this.onRestartBoxPacket(packet));
        } else if (packet.packetType === EPacketTypes.ADD_SSH_KEY) {
            this.answerFailure(packet, this.onChangeSshKeysPacket(packet, BoxSettingsService.get().addSshKey((packet as IAddSshKeyPacket).key)));
        } else if (packet.packetType === EPacketTypes.REMOVE_SSH_KEY) {
            this.answerFailure(packet, this.onChangeSshKeysPacket(packet,
                BoxSettingsService.get().removeSshKey((packet as IRemoveSshKeyPacket).fingerprint)));
        } else if (packet.packetType === EPacketTypes.SET_LANGUAGE) {
            this.onSetLanguagePacket(packet as ISetLanguagePacket);
        } else if (packet.packetType === EPacketTypes.SET_ACTIVE_EXTENSION) {
            this.onSetActiveExtensionPacket(packet as ISetActiveExtensionPacket);
        }
    }

    private onExtensionPacket(con: WebSocketConnection, packet: IGamePacket): void {
        const entry = this.extensionPacketHandlers.get(packet.packetType);
        if (entry == null) {
            LoggerService.warn(`Ignoring packet ${packet.packetType}, which no extension handles`);
            return;
        }
        const isFromMaster = con === this.webSocketConnectionMaster;
        if (!isFromMaster && !entry.isFromAnyConnection) {
            LoggerService.warn(`Ignoring packet ${packet.packetType} since only the master may send it`);
            return;
        }
        entry.handler(packet, isFromMaster);
    }

    /**
     * The screens show their texts in the master's language
     */
    private onSetLanguagePacket(packet: ISetLanguagePacket): void {
        const language = LanguageHelper.normalize(packet.language);
        if (language == null) {
            LoggerService.warn(`Ignoring the unknown language ${packet.language}`);
            return;
        }
        this.language = language;
        this.sendToAllScreens<ISetLanguagePacket>({packetType: EPacketTypes.SET_LANGUAGE, language});
    }

    /**
     * Switches an extension's mode on, or back to the quiz (null); only while no game is set up, since the mode takes
     * over the master and the screens
     */
    private onSetActiveExtensionPacket(packet: ISetActiveExtensionPacket): void {
        const extensionId = packet.extensionId ?? null;
        if (extensionId !== null && !this.startedExtensionIds.has(extensionId)) {
            LoggerService.warn(`Ignoring the mode of ${extensionId}, which isn't a started extension`);
        } else if (this.currentStateInAutomaton !== EGameStates.WAITING_FOR_SETUP) {
            LoggerService.warn(`Ignoring the mode of ${extensionId ?? 'the quiz'}, since a game is set up`);
        } else if (extensionId !== this.activeExtensionId) {
            this.activeExtensionId = extensionId;
            LoggerService.log(`The mode is now ${extensionId ?? 'the quiz'}`);
        }
        // the master is told in any case, so that it shows the mode that is on
        const answer: ISetActiveExtensionPacket = {packetType: EPacketTypes.SET_ACTIVE_EXTENSION, extensionId: this.activeExtensionId};
        this.sendToMaster<ISetActiveExtensionPacket>(answer);
        this.sendToAllScreens<ISetActiveExtensionPacket>(answer);
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
        // they stay awake while a game is running
        UdpBuzzerService.get().sendStateToAll();
    }

    /**
     * The buzzers of the box, from config.json's "buzzers": browser keypresses press them (in dev and the test
     * environment), and so can an extension, see IExtensionHost
     */
    private getBoxBuzzers(): IBuzzer[] {
        if (this.boxBuzzers == null) {
            const keys = ConfigService.get().buzzers.map(buzzer => buzzer.key);
            if (new Set(keys).size !== keys.length) {
                throw new Error("Cannot used the same key bind more than once");
            }
            this.boxBuzzers = ConfigService.get().buzzers.map(buzzer => ({
                name: buzzer.name,
                id: Uuid.v4(),
                keyBind: buzzer.key,
                type: 'serial',
                // optional in the config, so missing from its type
                color: BuzzerHelper.normalizeColor((buzzer as {color?: string}).color)
            }));
        }
        return this.boxBuzzers;
    }

    /**
     * Only while something can press them: the browser keypresses, or an extension (e.g. one for wired buzzers). A
     * box without either offers only the wireless buzzers.
     */
    private areBoxBuzzersEnabled(): boolean {
        return !!ConfigService.get().enableBrowserKeypressEvents || this.areBoxBuzzersEnabledByExtension;
    }

    /**
     * The buzzers of the box and the UDP buzzers found so far, which are only ever appended, so each keeps its index
     */
    private getAvailableBuzzers(): IBuzzer[] {
        return [...(this.areBoxBuzzersEnabled() ? this.getBoxBuzzers() : []), ...UdpBuzzerService.get().getBuzzers()];
    }

    private sendPresetupAvailableInfo(): void {
        this.sendToMaster<IPresetupAvailableInfoPacket>({
            packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO,
            availableBuzzers: this.getAvailableBuzzers(),
            analogBuzzers: this.areBoxBuzzersEnabled()
        });
    }

    private onSetupGamePackage(packet: ISetupPacket): void {
        if (this.currentStateInAutomaton !== EGameStates.WAITING_FOR_SETUP) {
            return;
        }
        if (this.activeExtensionId !== null) {
            LoggerService.warn(`Ignoring a setup while the mode of ${this.activeExtensionId} is on`);
            this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, false, `The mode of ${this.activeExtensionId} is on`));
            return;
        }
        let packetOk = true;
        // check if at least two teams are defined
        if (packet.teams.length < 2) {
            packetOk = false;
        }
        if (BuzzerHelper.isMixed(packet.teams.map(team => team.buzzerId))) {
            LoggerService.warn('Ignoring a setup with teams on the buzzers of the box and on UDP buzzers');
            packetOk = false;
        }

        const responsePacket: IResponsePacket = {
            packetType: EPacketTypes.RESPONSE_PACKET,
            responseTo: EPacketTypes.SETUP_GAME,
            wasSuccessful: packetOk
        }

        if (packetOk) {
            this.teams = packet.teams;
            this.applyBuzzerColors(this.teams);
            this.questions = packet.questions;
            // a new game is set up without a game state; a loaded save may lack fields added since it was made
            this.currentGameState = {...this.makeInitialGameState(), ...packet.currentGameState};
            // a savegame can't lock the buzzers, only a buzzer press can
            this.currentGameState.setBuzzerLock = this.keypressLocked;
            // theme, scoring, welcome screen and name; saved with the state, so a continued game keeps them
            GameStateHelper.applySetup(this.currentGameState, packet);
            this.resumesRunningGame = false;
            this.gameFinished = false;
            // a continued game may have a team marked
            UdpBuzzerService.get().sendStateToAll();
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
                this.sendPresetupAvailableInfo();
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
                this.sendPresetupAvailableInfo();
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
                        questions: this.questions,
                        currentGameState: this.currentGameState,
                        availableBuzzers: this.getAvailableBuzzers()
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
            this.sendToMaster<IUsbBuzzersPacket>({
                packetType: EPacketTypes.USB_BUZZERS,
                buzzers: BuzzerProvisioningService.get().getBuzzers()
            });
            // after the presetup data, so that a master that rejoins goes back to the mode's pages
            this.sendToMaster<ISetActiveExtensionPacket>({packetType: EPacketTypes.SET_ACTIVE_EXTENSION, extensionId: this.activeExtensionId});
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
    /**
     * An async handler that fails unexpectedly would end the server with an unhandled rejection; this logs it instead
     * and tells the master, which is waiting for the answer
     */
    private answerFailure(packet: IGamePacket, handling: Promise<void>): void {
        handling.catch(e => {
            LoggerService.error(`Could not handle packet ${packet.packetType}`, e);
            this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, false, `${e?.message ?? e}`));
        });
    }

    private async sendBoxSettings(): Promise<void> {
        this.sendToMaster<IBoxSettingsPacket>(await BoxSettingsService.get().read());
    }

    private async onSaveBoxSettingsPacket(packet: ISaveBoxSettingsPacket): Promise<void> {
        // the settings belong to the start page, where no game is set up
        const reason = this.currentStateInAutomaton !== EGameStates.WAITING_FOR_SETUP
            ? 'The settings can only be changed while no game is set up.'
            : await BoxSettingsService.get().save(packet.values);
        if (reason != null) {
            LoggerService.warn(`Not saving the box's settings: ${reason}`);
        }
        this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, reason == null, reason ?? undefined));
        await this.sendBoxSettings();
    }

    /**
     * Unlike the settings, the keys may change during a game: they don't touch it
     */
    private async onChangeSshKeysPacket(packet: IGamePacket, result: Promise<string | null>): Promise<void> {
        const reason = await result;
        if (reason != null) {
            LoggerService.warn(`Not changing the box's SSH keys: ${reason}`);
        }
        this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, reason == null, reason ?? undefined));
        await this.sendBoxSettings();
    }

    private async onRestartBoxPacket(packet: IGamePacket): Promise<void> {
        const reason = this.currentStateInAutomaton !== EGameStates.WAITING_FOR_SETUP
            ? 'The BuzzerBox can only be restarted while no game is set up.'
            : await BoxSettingsService.get().restart();
        if (reason != null) {
            LoggerService.warn(`Not restarting the box: ${reason}`);
        }
        this.sendToMaster<IResponsePacket>(PacketHelper.makeResponsePacket(packet.packetType, reason == null, reason ?? undefined));
    }

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
        } else if (isLegal && this.currentGameState.welcome) {
            // the welcome screen comes first: nobody may buzz yet, and the first question's media waits for it, see
            // onSetQuestionPacket()
            this.onSetBuzzerLockPacket(null, PacketHelper.makeBuzzerLockPacket(true));
            this.onUpdateMediaStatePacket(PacketHelper.makeMediaStatePacketFromQuestionState(PacketHelper.getDefaultMediaState()));
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
     * Awards the team that buzzed the points of the question, twice them for a double answer, and takes them away for a
     * wrong one, as far as the game's scoring allows (IGameState.scoring). A correct answer solves the question: it
     * reveals the correct answer options and keeps the buzzers locked. A wrong one releases the buzzers for the other
     * teams.
     */
    private onGradeAnswerPacket(packet: IGradeAnswerPacket): void {
        const team: ITeam = this.findTeam(packet.teamId);
        if (team == null) {
            LoggerService.warn(`Can't grade the answer of unknown team ${packet.teamId}`);
            return;
        }
        const scoring = this.currentGameState.scoring;
        if (!ScoringHelper.isAllowed(packet.result, scoring)) {
            LoggerService.warn(`Ignoring a double grade of team ${packet.teamId}: this game has no double points`);
            return;
        }
        const question = this.getCurrentQuestion();
        const isCorrect = packet.result !== EGradeResults.WRONG;
        team.points = (team.points ?? 0) + ScoringHelper.getPointsChange(packet.result, question?.points ?? 1, scoring);
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
            this.releaseHardwareBuzzerLock();
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
        const buzzers = this.getAvailableBuzzers();
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
        // like in the setup, a game needs at least two teams, all on the same kind of buzzers
        if (newTeams.length < 2 || BuzzerHelper.isMixed(newTeams.map(team => team.buzzerId))) {
            LoggerService.warn('Ignoring invalid teams', packet.teams);
            // let the master show the teams that are still in place
            this.sendToMaster<IUpdateTeamsPacket>({packetType: EPacketTypes.UPDATE_TEAMS, teams: this.teams});
            return;
        }
        this.teams = newTeams;
        this.applyBuzzerColors(this.teams);
        const isRemoved = (teamId: string) => !newTeams.some(team => team.teamId === teamId);
        if ((this.currentGameState.markedTeamIds ?? []).some(isRemoved)) {
            this.unmarkAllTeams();
            this.setKeypressLocked(false);
            this.releaseHardwareBuzzerLock();
        }
        const updateTeamsPacket: IUpdateTeamsPacket = {packetType: EPacketTypes.UPDATE_TEAMS, teams: this.teams};
        this.sendToMaster<IUpdateTeamsPacket>(updateTeamsPacket);
        this.sendToAllScreens<IUpdateTeamsPacket>(updateTeamsPacket);
    }

    /**
     * Gives each team the color of its buzzer, so that the screens show it without knowing the buzzers
     * @return whether a team's color changed
     */
    private applyBuzzerColors(teams: ITeam[]): boolean {
        const buzzers = this.getAvailableBuzzers();
        let changed = false;
        for (const team of teams) {
            const color = buzzers.find(buzzer => buzzer.id === team.buzzerId)?.color;
            if (team.color !== color) {
                if (color == null) {
                    delete team.color;
                } else {
                    team.color = color;
                }
                changed = true;
            }
        }
        return changed;
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
            this.releaseHardwareBuzzerLock();
            if (this.lastBuzzerIdPressed != null) {
                // if the answer is wrong an there is a last buzzer press, then ignore it for this round
                // TODO: shall be configurable, will be done somewhat later
                // this.ignoredBuzzerIds.push(this.lastBuzzerIdPressed);
            }
        }
        this.sendToAllScreens(packet);
    }

    /**
     * Also ends the welcome screen, see IGameState.welcome
     */
    private onSetQuestionPacket(packet: ISetQuestionPacket): void {
        this.currentGameState.welcome = false;
        const value: number = packet.set;
        if (value >= 0 && value <= this.questions.length - 1) {
            this.currentGameState.currentQuestionNumber = value;
        }
        GameStateHelper.resetQuestionProgress(this.currentGameState);
        // this.setKeypressLocked(false);
        const lockPacket: ISetBuzzerLockPacket = PacketHelper.makeBuzzerLockPacket(false);
        this.onSetBuzzerLockPacket(null, lockPacket);
        this.ignoredBuzzerIds = [];
        this.sendToAllScreens(packet);
        let questionConfig = PacketHelper.getDefaultMediaState();
        if (this.getCurrentQuestion().initialConfig) {
            questionConfig = this.getCurrentQuestion().initialConfig;
        }
        this.currentGameState.mediaQuestionState = questionConfig;
        const mediaPacket: IUpdateMediaStatePacket = PacketHelper.makeMediaStatePacket(questionConfig.mediaState, questionConfig.questionState, questionConfig.answerState);
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
        this.gameFinished = true;
        this.sendToAllScreens(packet);
    }

    private onRegisterScreenPacket(con: WebSocketConnection, sub: Subscription, packet: IRegisterScreenPacket): void {
        this.webSocketConnectionsScreens.set(packet.screenId, con);
        if (this.language != null) {
            con.send<ISetLanguagePacket>({packetType: EPacketTypes.SET_LANGUAGE, language: this.language});
        }
        con.send<ISetActiveExtensionPacket>({packetType: EPacketTypes.SET_ACTIVE_EXTENSION, extensionId: this.activeExtensionId});
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
            questions: this.questions.map(({notes, ...question}) => question),
            gameState: this.currentGameState
        }
    }

    private onResetServerPacket(packet: IResetServerPacket): void {
        this.setNewState(EGameStates.WAITING_FOR_SETUP);
        this.sendPresetupAvailableInfo();
        this.sendToAllScreens(packet);
        if (packet.discardState) {
            AutosaveService.get().discard();
        }
        this.resetServerData();
    }

    private resetServerData(): void {
        // saves the game as it was, before it is cleared
        AutosaveService.get().end();
        this.teams = [];
        this.questions = [];
        this.setKeypressLocked(false)
        this.releaseHardwareBuzzerLock();
        this.ignoredBuzzerIds = [];
        this.lastBuzzerIdPressed = null;
        this.resumesRunningGame = false;
        this.currentGameState = this.makeInitialGameState();
        UdpBuzzerService.get().sendStateToAll();
    }

    private makeInitialGameState(): IGameState {
        return {
            mediaQuestionState: {
                mediaState: EMediaStates.NO_MEDIA,
                questionState: EQuestionAnswerStates.SHOWN,
                answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA
            },
            mediaVolume: PacketHelper.getDefaultMediaVolume(),
            currentQuestionNumber: 0,
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
            this.releaseHardwareBuzzerLock();
            this.unmarkAllTeams();
            return;
        }
        const buzzer = this.getBoxBuzzers().find(b => b.keyBind === packet.keyCode);
        if (buzzer == null) {
            LoggerService.log("no buzzer for keycode " + packet.keyCode);
            return;
        }
        this.pressBuzzers([buzzer.id]);
    }

    /**
     * Releases the buzzers; origin is the extension that released them, which isn't told, see
     * IExtensionHost.onLockReleased
     */
    private releaseHardwareBuzzerLock(origin?: string) {
        const lockPacket: ISetBuzzerLockPacket = PacketHelper.makeBuzzerLockPacket(false);
        this.onSetBuzzerLockPacket(null, lockPacket, origin);
    }

    /**
     * The release on the box, see IExtensionHost.releaseFromBox
     */
    private releaseFromBox(extensionId: string): void {
        this.unmarkAllTeams();
        this.setKeypressLocked(false);
        this.releaseHardwareBuzzerLock(extensionId);
        if (this.isGameSetUp()) {
            AutosaveService.get().changed();
        }
    }

    private setKeypressLocked(locked: boolean): void {
        this.keypressLocked = locked;
        this.currentGameState.setBuzzerLock = locked;
        UdpBuzzerService.get().sendStateToAll();
    }

    private unmarkAllTeams(): void {
        const unmarkTeamsPacket: IMarkTeamPacket = PacketHelper.makeUnmarkAllTeamsPacket();
        GameStateHelper.applyMarkTeam(this.currentGameState, unmarkTeamsPacket);
        this.sendToMaster<IMarkTeamPacket>(unmarkTeamsPacket);
        this.sendToAllScreens<IMarkTeamPacket>(unmarkTeamsPacket);
        UdpBuzzerService.get().sendStateToAll();
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

    private onMarkTeamPacket(packet: IMarkTeamPacket): void {
        GameStateHelper.applyMarkTeam(this.currentGameState, packet);
        this.sendToMaster<IMarkTeamPacket>(packet);
        this.sendToAllScreens<IMarkTeamPacket>(packet);
        UdpBuzzerService.get().sendStateToAll();
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

    private onSetBuzzerLockPacket(con: WebSocketConnection, packet: ISetBuzzerLockPacket, origin?: string): void {
        this.setKeypressLocked(packet.setLock);
        // it is very likely, that the master already reloaded the page, thus this is null
        this.sendToMaster<ISetBuzzerLockPacket>(packet);
        this.sendToAllScreens<ISetBuzzerLockPacket>(packet);
        // e.g. the box's own lock is released too
        if (!packet.setLock) {
            for (const callback of this.lockReleasedCallbacks) {
                try {
                    callback(origin);
                } catch (e) {
                    LoggerService.error('An extension failed on the release of the buzzers', e);
                }
            }
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

    private lockOnTeam(team: ITeam) {
        ObjectHelper.ensureNotNull(team);
        this.setKeypressLocked(true);
        const markTeamPacket: IMarkTeamPacket = PacketHelper.makeMarkTeamPacket(team.teamId, true);
        GameStateHelper.applyMarkTeam(this.currentGameState, markTeamPacket);
        // the team's buzzer lights up
        UdpBuzzerService.get().sendStateToAll();
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

    /**
     * The earliest press that counts wins: buzzers without a team, or ignored ones, don't block the others. Presses
     * while the buzzers are locked don't count.
     */
    private pressBuzzers(buzzerIds: string[]): void {
        if (this.isKeypressLocked()) {
            return;
        }
        for (const buzzerId of buzzerIds) {
            const team = this.teams.find(t => t.buzzerId === buzzerId);
            if (team != null && !this.ignoredBuzzerIds.includes(buzzerId)) {
                this.lastBuzzerIdPressed = buzzerId;
                this.lockOnTeam(team);
                if (this.isGameSetUp()) {
                    AutosaveService.get().changed();
                }
                return;
            }
        }
        LoggerService.log(`no team found for buzzers ${buzzerIds.join(', ')}`);
    }

    /**
     * What a UDP buzzer shows: whether its team buzzed and is marked, and whether presses count. While a game with UDP
     * buzzers is running (also while its master is away), they stay awake.
     */
    private getUdpBuzzerState(buzzerId: string): IUdpBuzzerState {
        const team = this.teams.find(t => t.buzzerId === buzzerId);
        return {
            selected: team != null && (this.currentGameState.markedTeamIds ?? []).includes(team.teamId),
            locked: this.keypressLocked,
            game: this.isGameRunning() && this.teams.some(t => BuzzerHelper.isUdpBuzzerId(t.buzzerId))
        };
    }
}
