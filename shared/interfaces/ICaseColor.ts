/**
 * A color the case of a wireless buzzer comes in, see BuzzerHelper.CASE_COLORS
 */
export interface ICaseColor {
    /** "#rrggbb", which the buzzer keeps and the screens show its team in */
    color: string;
    /**
     * Stands for the color in the client's texts: "caseColors.<key>.name" is its name ("Blau") and
     * "caseColors.<key>.buzzer" the name of a buzzer in that color ("Blauer Wireless Buzzer")
     */
    key: string;
}
