import {IGamePacket, EPacketTypes, ITeam, IQuestion, IGameState, IGameStorageRef, IScoring} from '../shared';

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
    /**
     * How the screens look in this game, see IGameState.themeId
     */
    themeId?: string;
    /**
     * How answers are scored in this game, see IGameState.scoring
     */
    scoring?: IScoring;
}
