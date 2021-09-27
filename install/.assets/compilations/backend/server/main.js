"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_server_service_1 = require("./services/http-server.service");
const game_service_1 = require("./services/game.service");
const config_service_1 = require("./services/config.service");
http_server_service_1.HttpServerService.get().start(config_service_1.ConfigService.get().server.port);
game_service_1.GameService.startGame();
//# sourceMappingURL=main.js.map