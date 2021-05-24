import {IGamePacket, EPacketTypes} from '../shared';

export interface IGameState {
    currentQuestionNumber: number;
    answerLoggedIn?: 0 | 1 | 2 | 3;
}
