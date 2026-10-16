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
}
