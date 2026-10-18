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
    END_GAME,
    DATA_FOR_SCREEN,
    RESET_SERVER,
    KEYPRESS_ON_SCREEN,
    MARK_TEAM,
    SET_BUZZER_LOCK,
    WEBSOCKET_CONNECTION_SUCCESSFUL, // no interface exists for this one!
    UPDATE_MEDIA_STATE,
    SET_MEDIA_VOLUME,
    GRADE_ANSWER,
    UPDATE_TEAMS,
    UPDATE_INFO,
    INSTALL_UPDATE,
    /**
     * Sent from the server to the master when it registers: the token for the storage API (see StorageApiHelper)
     */
    STORAGE_ACCESS,
    /**
     * Sent from the server to the master when it saved the running game, see IAutosaveInfoPacket
     */
    AUTOSAVE_INFO,
    /**
     * Sent from the server to the master when another device took over as master, see IRegisterMasterPacket.takeOver
     */
    MASTER_TAKEN_OVER,
    /**
     * Sent from the server to the master when the available buzzers change, see IAvailableBuzzersPacket
     */
    AVAILABLE_BUZZERS,
}
