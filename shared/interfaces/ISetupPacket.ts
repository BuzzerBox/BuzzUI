import {IGamePacket, EPacketTypes, ITeam, IQuestion, IGameState, IGameStorageRef} from '../shared';

export interface ISetupPacket extends IGamePacket {
    packetType: EPacketTypes.SETUP_GAME;
    /**
     * The teams playing
     */
    teams: ITeam[];
    questions: IQuestion[];
    currentGameState?: IGameState
    /**
     * Where the game is stored, so its state is saved there while it is played
     */
    storage?: IGameStorageRef;
    /**
     * Whether storage.stateName is a new state; the server makes the name unique then
     */
    isNewState?: boolean;
}
