"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PacketHelper = void 0;
const enums_1 = require("../enums");
class PacketHelper {
    constructor() {
        // making it private to avoid this class being instantiated
    }
    static makeResponsePacket(responseTo, wasSuccessful, reason) {
        return {
            packetType: enums_1.EPacketTypes.RESPONSE_PACKET,
            responseTo: responseTo,
            wasSuccessful,
            reason
        };
    }
    static makeMarkTeamPacket(teamId, mark) {
        return {
            packetType: enums_1.EPacketTypes.MARK_TEAM,
            teamId,
            mark
        };
    }
    static makeUnmarkAllTeamsPacket() {
        const p = this.makeMarkTeamPacket(null, null);
        p.unmarkAll = true;
        return p;
    }
    static makeBuzzerLockPacket(setLock) {
        return {
            packetType: enums_1.EPacketTypes.SET_BUZZER_LOCK,
            setLock
        };
    }
    static makeAnswerSetSatePacket(state, answer) {
        return {
            packetType: enums_1.EPacketTypes.ANSWER_SET_STATE,
            state,
            answer
        };
    }
    static makeSetQuestionPacket(set) {
        return {
            packetType: enums_1.EPacketTypes.SET_QUESTION,
            set
        };
    }
    static makeEndGamePacket() {
        return {
            packetType: enums_1.EPacketTypes.END_GAME
        };
    }
    static makeKeypressOnScreenPacket(keyCode) {
        return {
            packetType: enums_1.EPacketTypes.KEYPRESS_ON_SCREEN,
            keyCode
        };
    }
}
exports.PacketHelper = PacketHelper;
//# sourceMappingURL=packet.helper.js.map