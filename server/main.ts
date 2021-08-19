import {HttpServerService} from "./services/http-server.service";
import {GameService} from "./services/game.service";
import {ConfigService} from './services/config.service';

HttpServerService.get().start(ConfigService.get().server.port);
GameService.startGame();
