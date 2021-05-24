import {IGamePacket, EPacketTypes, EGameStates, ITeam, IQuestion, IGameState} from '../shared';

export interface INewMasterAccepted extends IGamePacket {
    packetType: EPacketTypes.NEW_MASTER_ACCEPTED;
    serverState: EGameStates;
    teams: ITeam[];
    questions: IQuestion[];
    /**
     * If no gamestate is sent, then the game has not started yet
     */
    currentGameState?: IGameState
}
