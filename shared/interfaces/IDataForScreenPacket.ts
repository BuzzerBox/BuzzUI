import {IGamePacket, EPacketTypes, IGameState, ITeam} from '../shared';
import {IRound} from './IRound';

export interface IDataForScreenPacket extends IGamePacket {
    packetType: EPacketTypes.DATA_FOR_SCREEN;
    teams: ITeam[];
    rounds: IRound[];
    gameState: IGameState;
}
