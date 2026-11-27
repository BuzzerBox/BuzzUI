import {IGamePacket, IBuzzer} from '../../shared/shared';

/**
 * A part of the server that isn't in this repository's core, e.g. a kind of buzzer that only some boxes have. The
 * server starts each extension once, after its own services (see startServer in app.ts), and hands it an
 * IExtensionHost, through which it takes part in the game. See docs/extensions.md.
 */
export interface IServerExtension {
    /** Unique and stable, e.g. 'serial-buzzers'; also tells the host who released the buzzers, see onLockReleased */
    readonly id: string;

    start(host: IExtensionHost): void;
}

/**
 * Handles a packet of an extension, see IExtensionHost.registerPacketHandler
 */
export type TExtensionPacketHandler = (packet: IGamePacket, isFromMaster: boolean) => void;

/**
 * What the server offers an extension. It's all an extension needs to know of the game: it doesn't reach into the
 * services of the core.
 */
export interface IExtensionHost {
    /**
     * The buzzers of the box: those of config.json's "buzzers", which browser keypresses press in dev. The master
     * only offers them while something can press them, i.e. when the browser keypresses are on or an extension
     * called enableBoxBuzzers(). Their IDs stay the same while the server runs, and their order is the config's.
     */
    getBoxBuzzers(): IBuzzer[];

    /**
     * Offers the buzzers of the box to the master, since this extension presses them
     */
    enableBoxBuzzers(): void;

    /**
     * A buzzer was pressed. The first press that counts marks its team and locks the buzzers; presses while they are
     * locked, and of buzzers without a team, are ignored.
     */
    pressBuzzer(buzzerId: string): void;

    /**
     * The release on the box (e.g. its button) released the buzzers: like the master's release, without a grade. The
     * extension doesn't hear of it through onLockReleased, since it released them itself.
     */
    releaseFromBox(extensionId: string): void;

    /**
     * Calls back whenever the buzzers are released: by the master, by the game (a new question, a wrong answer, a
     * reset) or by an extension, whose ID is the origin (undefined for the others).
     */
    onLockReleased(callback: (origin: string | undefined) => void): void;

    /**
     * The value of a setting of buzzerbox.txt as the box applied it when the server started (see BoxSettingsService),
     * or undefined. An extension's own settings are registered with BoxSettingsHelper.register().
     */
    getBoxSetting(key: string): string | undefined;

    /**
     * Handles the packets of one of the extension's own packet types, which start at
     * PacketTypeHelper.FIRST_EXTENSION_PACKET_TYPE so that they never clash with the core's. Like the core's, they
     * are only taken from the master, unless isFromAnyConnection is set.
     */
    registerPacketHandler(packetType: number, handler: TExtensionPacketHandler, options?: {isFromAnyConnection?: boolean}): void;

    sendToMaster(packet: IGamePacket): void;

    sendToAllScreens(packet: IGamePacket): void;

    /** A game is set up and not over yet */
    isGameRunning(): boolean;

    /**
     * The ID of the extension whose mode is on, or null for the quiz (see ISetActiveExtensionPacket). The master
     * switches it; an extension only finds out which one is on.
     */
    getActiveExtension(): string | null;
}
