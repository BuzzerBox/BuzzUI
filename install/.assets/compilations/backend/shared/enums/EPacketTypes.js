"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EPacketTypes = void 0;
var EPacketTypes;
(function (EPacketTypes) {
    EPacketTypes[EPacketTypes["RESPONSE_PACKET"] = 0] = "RESPONSE_PACKET";
    /**
     * This one is used, when no game is started yet
     */
    EPacketTypes[EPacketTypes["REGISTER_MASTER"] = 1] = "REGISTER_MASTER";
    EPacketTypes[EPacketTypes["REGISTER_SCREEN"] = 2] = "REGISTER_SCREEN";
    EPacketTypes[EPacketTypes["PRESETUP_AVAILABLE_INFO"] = 3] = "PRESETUP_AVAILABLE_INFO";
    EPacketTypes[EPacketTypes["SETUP_GAME"] = 4] = "SETUP_GAME";
    /**
     * This one is sent from the backend, if a master tries to register to an existing game that has no master anymore
     */
    EPacketTypes[EPacketTypes["NEW_MASTER_ACCEPTED"] = 5] = "NEW_MASTER_ACCEPTED";
    EPacketTypes[EPacketTypes["START_GAME"] = 6] = "START_GAME";
    EPacketTypes[EPacketTypes["TEAM_SET_POINTS"] = 7] = "TEAM_SET_POINTS";
    EPacketTypes[EPacketTypes["ANSWER_SET_STATE"] = 8] = "ANSWER_SET_STATE";
    EPacketTypes[EPacketTypes["SET_QUESTION"] = 9] = "SET_QUESTION";
    EPacketTypes[EPacketTypes["END_GAME"] = 10] = "END_GAME";
    EPacketTypes[EPacketTypes["DATA_FOR_SCREEN"] = 11] = "DATA_FOR_SCREEN";
    EPacketTypes[EPacketTypes["RESET_SERVER"] = 12] = "RESET_SERVER";
    EPacketTypes[EPacketTypes["KEYPRESS_ON_SCREEN"] = 13] = "KEYPRESS_ON_SCREEN";
    EPacketTypes[EPacketTypes["MARK_TEAM"] = 14] = "MARK_TEAM";
    EPacketTypes[EPacketTypes["SET_BUZZER_LOCK"] = 15] = "SET_BUZZER_LOCK";
    EPacketTypes[EPacketTypes["WEBSOCKET_CONNECTION_SUCCESSFUL"] = 16] = "WEBSOCKET_CONNECTION_SUCCESSFUL"; // no interface exists for this one!
})(EPacketTypes = exports.EPacketTypes || (exports.EPacketTypes = {}));
//# sourceMappingURL=EPacketTypes.js.map
