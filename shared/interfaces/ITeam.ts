export interface ITeam {
    name: string;
    points?: number;
    buzzerId: string;
    teamId: string;
    /**
     * Position of the team's buzzer in the config. Buzzer IDs are generated anew on every server start, so savegames
     * use this to put each team back on its buzzer.
     */
    buzzerIndex?: number;
    /**
     * The color of the team's buzzer (IBuzzer.color), which the server sets, so that the screens show the team in it.
     * Missing if the buzzer has none; then the team gets one by its buzzerIndex, see the client's TeamColorHelper.
     */
    color?: string;
}
