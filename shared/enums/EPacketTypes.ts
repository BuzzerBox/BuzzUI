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
    /**
     * Sent from the server to the master when the wireless buzzers plugged in over USB change, see IUsbBuzzersPacket
     */
    USB_BUZZERS,
    /**
     * Sent from the master to give a wireless buzzer plugged in over USB the box's WiFi, see IAdoptUsbBuzzerPacket
     */
    ADOPT_USB_BUZZER,
    /**
     * Sent from the master to get the box's settings (buzzerbox.txt); the server answers with BOX_SETTINGS. It has no
     * interface of its own, it is a plain IGamePacket.
     */
    REQUEST_BOX_SETTINGS,
    /**
     * Sent from the server to the master with the box's settings, see IBoxSettingsPacket
     */
    BOX_SETTINGS,
    /**
     * Sent from the master to change the box's settings, see ISaveBoxSettingsPacket
     */
    SAVE_BOX_SETTINGS,
    /**
     * Sent from the master to restart the box, so that changed settings count; a plain IGamePacket. Only allowed while
     * no game is set up.
     */
    RESTART_BOX,
    /**
     * Sent from the master to allow an SSH key on the box, see IAddSshKeyPacket
     */
    ADD_SSH_KEY,
    /**
     * Sent from the master to remove an SSH key from the box, see IRemoveSshKeyPacket
     */
    REMOVE_SSH_KEY,
}
