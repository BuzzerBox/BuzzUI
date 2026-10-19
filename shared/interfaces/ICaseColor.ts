/**
 * A color the case of a wireless buzzer comes in, see BuzzerHelper.CASE_COLORS
 */
export interface ICaseColor {
    /** "#rrggbb", which the buzzer keeps and the screens show its team in */
    color: string;
    name: string;
    /** For the buzzer's name, e.g. "Blauer" in "Blauer Wireless Buzzer" */
    adjective: string;
}
