import config from '../config.json';
import {HttpServerService} from "./services/http-server.service";
import {GameService} from "./services/game.service";

HttpServerService.get().start(config.server.port);
GameService.startGame();
