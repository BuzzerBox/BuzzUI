import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent by the master to open a tile of the Jeopardy board that is played, or to go back to the board; the server
 * forwards it to the screens. See JeopardyRoundRules.applySelectQuestion.
 */
export interface ISelectQuestionPacket extends IGamePacket {
    packetType: EPacketTypes.SELECT_QUESTION;
    /**
     * The question of the tile to open, null to close the open one and show the board again
     */
    questionId: string | null;
    /**
     * Only when closing: whether the tile is played, e.g. as no team knew the answer. A tile closed without it can be
     * opened again.
     */
    markPlayed?: boolean;
}
