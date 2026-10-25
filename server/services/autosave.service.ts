import {BehaviorSubject, Observable} from 'rxjs';
import {
    CURRENT_GAME_FORMAT_VERSION,
    EPacketTypes,
    IAutosaveInfoPacket,
    IGameInstanceState,
    IGameState,
    IGameStorageRef,
    ITeam
} from '../../shared/shared';
import {StorageError, StorageService} from './storage.service';
import {ClockService} from './clock.service';
import {LoggerService} from './logger.service';

/**
 * What of the running game is saved
 */
export interface IAutosaveSnapshot {
    teams: ITeam[];
    gameState: IGameState;
    finished: boolean;
}

/**
 * Saves the state of the game that is played into its state file, a moment after every change. If saving fails, e.g.
 * since the USB stick was pulled out, it is tried again, and the master is told.
 */
export class AutosaveService {
    private static instance: AutosaveService;
    private static readonly DELAY_IN_MS = 1000;
    private static readonly RETRY_INTERVAL_IN_MS = 10000;

    private ref: IGameStorageRef | null = null;
    private createdAt: string;
    private takeSnapshot: () => IAutosaveSnapshot;
    // resolves once the state's name is known
    private ready: Promise<void> = Promise.resolve();
    private timer: ReturnType<typeof setTimeout> | null = null;
    private saving: Promise<void> | null = null;
    private dirty = false;
    private readonly infoSubject = new BehaviorSubject<IAutosaveInfoPacket>({packetType: EPacketTypes.AUTOSAVE_INFO, storage: null});

    private constructor() {
    }

    public static get(): AutosaveService {
        if (this.instance == null) {
            this.instance = new AutosaveService();
        }
        return this.instance;
    }

    public observeInfo(): Observable<IAutosaveInfoPacket> {
        return this.infoSubject.asObservable();
    }

    public getInfo(): IAutosaveInfoPacket {
        return this.infoSubject.getValue();
    }

    /**
     * Starts saving a game that was set up, right away and then after every change
     * @param isNewState whether the state is new, so its name is made unique
     */
    public begin(ref: IGameStorageRef, isNewState: boolean, takeSnapshot: () => IAutosaveSnapshot): void {
        this.stop();
        this.ref = {...ref};
        this.takeSnapshot = takeSnapshot;
        this.createdAt = ClockService.get().nowAsIsoString();
        StorageService.get().setActiveGame(this.ref);
        const current = this.ref;
        this.ready = (async () => {
            if (isNewState) {
                current.stateName = await StorageService.get().makeUniqueStateName(ref.locationId, ref.gameName, ref.stateName);
            } else {
                this.createdAt = (await StorageService.get().getStateOrNull(ref))?.createdAt ?? this.createdAt;
            }
        })().catch(e => LoggerService.error('Could not prepare saving the game', e));
        this.changed();
    }

    /**
     * Saves a moment later, so changes that come together are saved together
     */
    public changed(): void {
        if (this.ref == null) {
            return;
        }
        this.dirty = true;
        if (this.timer == null) {
            this.timer = setTimeout(() => {
                this.timer = null;
                this.save();
            }, AutosaveService.DELAY_IN_MS);
        }
    }

    /**
     * Saves now what has changed and stops saving, e.g. since the game was reset. The state is taken right away, before
     * the game is cleared.
     */
    public end(): void {
        if (this.ref == null) {
            return;
        }
        if (this.dirty) {
            const ref = this.ref;
            const state = this.makeState(this.takeSnapshot());
            const ready = this.ready;
            (async () => {
                await ready;
                await this.saving;
                await StorageService.get().writeState(ref, state);
            })().catch(e => LoggerService.error(`Could not save ${ref.stateName} of ${ref.gameName}`, e));
        }
        this.stop();
        this.infoSubject.next({packetType: EPacketTypes.AUTOSAVE_INFO, storage: null});
    }

    /**
     * Stops saving and deletes the state, e.g. since the game was discarded
     */
    public discard(): void {
        if (this.ref == null) {
            return;
        }
        const ref = this.ref;
        const ready = this.ready;
        const saving = this.saving;
        // the state is no longer the active one, which can't be deleted
        this.stop();
        this.infoSubject.next({packetType: EPacketTypes.AUTOSAVE_INFO, storage: null});
        (async () => {
            // a new state gets its unique name first, and a save that is underway would write it again
            await ready;
            await saving;
            await StorageService.get().deleteState(ref.locationId, ref.gameName, ref.stateName);
            LoggerService.log(`Discarded ${ref.stateName} of ${ref.gameName}`);
        })().catch(e => {
            // a state that was never saved is gone already
            if (!(e instanceof StorageError && e.status === 404)) {
                LoggerService.error(`Could not delete ${ref.stateName} of ${ref.gameName}`, e);
            }
        });
    }

    private stop(): void {
        if (this.timer != null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.ref = null;
        this.dirty = false;
        StorageService.get().setActiveGame(null);
    }

    private save(): Promise<void> {
        if (this.saving != null) {
            // saved again once this save is done, since dirty stays set
            return this.saving;
        }
        const ref = this.ref;
        this.saving = (async () => {
            await this.ready;
            if (ref !== this.ref || !this.dirty) {
                return;
            }
            this.dirty = false;
            const state = this.makeState(this.takeSnapshot());
            const locationName = await StorageService.get().getLocationName(ref.locationId).catch(() => undefined);
            try {
                await StorageService.get().writeState(ref, state);
                if (ref === this.ref) {
                    this.infoSubject.next({packetType: EPacketTypes.AUTOSAVE_INFO, storage: {...ref}, locationName, savedAt: state.updatedAt});
                }
            } catch (e) {
                LoggerService.warn(`Could not save ${ref.stateName} of ${ref.gameName}`, e);
                if (ref === this.ref) {
                    this.dirty = true;
                    const error = e instanceof StorageError ? e.message : 'Could not save the game';
                    this.infoSubject.next({...this.getInfo(), packetType: EPacketTypes.AUTOSAVE_INFO, storage: {...ref}, locationName, error});
                    setTimeout(() => this.changed(), AutosaveService.RETRY_INTERVAL_IN_MS);
                }
            }
        })().finally(() => {
            this.saving = null;
            if (this.dirty && this.ref === ref && this.timer == null && this.getInfo().error == null) {
                this.changed();
            }
        });
        return this.saving;
    }

    private makeState(snapshot: IAutosaveSnapshot): IGameInstanceState {
        return {
            formatVersion: CURRENT_GAME_FORMAT_VERSION,
            kind: 'state',
            gameVersion: this.ref.gameVersion,
            createdAt: this.createdAt,
            updatedAt: ClockService.get().nowAsIsoString(),
            finished: snapshot.finished,
            teams: snapshot.teams,
            gameState: snapshot.gameState
        };
    }
}
