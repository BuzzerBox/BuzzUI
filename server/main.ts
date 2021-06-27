import config from '../config.json';
import {HttpServerService} from "./services/http-server.service";
import {GameService} from "./services/game.service";
import {I2cService} from "./services/i2c.service";

HttpServerService.get().start(config.server.port);
GameService.startGame();
I2cService.get().test();
