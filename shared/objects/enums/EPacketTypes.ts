export enum EPacketTypes {
    RESPONSE_PACKET,
    /**
     * This one is used, when no game is started yet
     */
    REGISTER_MASTER,
    REGISTER_SCREEN,
    PRESETUP_AVAILABLE_INFO,
    SETUP_GAME,
    /**
     * This one is sent from the server, if a master tries to register to an existing game that has no master anymore
     */
    NEW_MASTER_ACCEPTED,
    START_GAME,
    TEAM_SET_POINTS,
    ANSWER_SET_STATE,
    SET_QUESTION,
    END_GAME
}
