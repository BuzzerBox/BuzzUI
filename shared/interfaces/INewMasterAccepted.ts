import {IGamePacket, EPacketTypes, EGameStates, ITeam, IGameState, IBuzzer} from '../shared';
import {IRound} from './IRound';

export interface INewMasterAccepted extends IGamePacket {
    packetType: EPacketTypes.NEW_MASTER_ACCEPTED;
    serverState: EGameStates;
    teams: ITeam[];
    rounds: IRound[];
    /**
     * If no gamestate is sent, then the game has not started yet
     */
    currentGameState?: IGameState
    /**
     * The buzzers, so the rejoined master can change the teams
     */
    availableBuzzers?: IBuzzer[];
}
