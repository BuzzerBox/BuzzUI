import {IGamePacket, EPacketTypes, IGameState, ITeam, IQuestion} from '../shared';

export interface IDataForScreenPacket extends IGamePacket {
    packetType: EPacketTypes.DATA_FOR_SCREEN;
    teams: ITeam[];
    questions: IQuestion[];
    gameState: IGameState;
}
