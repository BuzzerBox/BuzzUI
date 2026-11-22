import {HttpServerService} from "./services/http-server.service";
import {GameService} from "./services/game.service";
import {ConfigService} from './services/config.service';
import {FileServerService} from "./services/file-server.service";
import {BuzzerProvisioningService} from "./services/buzzer-provisioning.service";
import {IServerExtension} from './extensions/server-extension';

/**
 * Starts the server with the given extensions, see docs/extensions.md. main.ts starts it with the built-in ones; a
 * build with other extensions has a main of its own that calls this.
 */
export function startServer(extensions: IServerExtension[]): void {
    const config = ConfigService.get();
    HttpServerService.get().start(config.server.port);
    FileServerService.get().start(config.fileServer.port, config.fileServer.localPath);
    GameService.startGame();
    GameService.get().startExtensions(extensions);
    // looks for wireless buzzers plugged in over USB
    BuzzerProvisioningService.get();
}
