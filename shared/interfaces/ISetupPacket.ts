import {IGamePacket, EPacketTypes, ITeam, IGameState, IGameStorageRef} from '../shared';
import {IRound} from './IRound';

export interface ISetupPacket extends IGamePacket {
    packetType: EPacketTypes.SETUP_GAME;
    /**
     * The teams playing
     */
    teams: ITeam[];
    rounds: IRound[];
    currentGameState?: IGameState
    /**
     * Where the game is stored, so its state is saved there while it is played
     */
    storage?: IGameStorageRef;
    /**
     * Whether storage.stateName is a new state; the server makes the name unique then
     */
    isNewState?: boolean;
    /**
     * How the screens look in this game, see IGameState.themeId
     */
    themeId?: string;
}
