import {HttpServerService} from "./services/http-server.service";
import {GameService} from "./services/game.service";
import {ConfigService} from './services/config.service';
import {FileServerService} from "./services/file-server.service";
import {BuzzerProvisioningService} from "./services/buzzer-provisioning.service";

const config = ConfigService.get();
HttpServerService.get().start(config.server.port);
FileServerService.get().start(config.fileServer.port, config.fileServer.localPath);
GameService.startGame();
// looks for wireless buzzers plugged in over USB
BuzzerProvisioningService.get();
