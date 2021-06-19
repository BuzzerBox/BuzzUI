import {IGamePacket, EPacketTypes, ITeam, IQuestion, IGameState} from '../shared';

export interface ISetupPacket extends IGamePacket {
    packetType: EPacketTypes.SETUP_GAME;
    /**
     * The teams playing
     */
    teams: ITeam[];
    questions: IQuestion[];
    currentGameState?: IGameState
}
