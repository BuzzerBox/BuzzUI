"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EGameStates = void 0;
var EGameStates;
(function (EGameStates) {
    EGameStates[EGameStates["WAITING_FOR_MASTER"] = 0] = "WAITING_FOR_MASTER";
    EGameStates[EGameStates["WAITING_FOR_ACTION"] = 1] = "WAITING_FOR_ACTION";
    EGameStates[EGameStates["WAITING_FOR_SETUP"] = 2] = "WAITING_FOR_SETUP";
    EGameStates[EGameStates["WAITING_FOR_START"] = 3] = "WAITING_FOR_START";
    EGameStates[EGameStates["LOST_MASTER"] = 4] = "LOST_MASTER";
    EGameStates[EGameStates["PLAYING"] = 5] = "PLAYING";
    EGameStates[EGameStates["END"] = 6] = "END";
})(EGameStates = exports.EGameStates || (exports.EGameStates = {}));
//# sourceMappingURL=EGameStates.js.map