/**
 * What teams may wager on a Daily Double or in the final
 */
export class WagerHelper {
    private constructor() {
        // hide public constructor
    }

    /**
     * A wager as a whole number from 0 up to the maximum; null if it isn't a number
     */
    public static clamp(wager: unknown, max: number): number | null {
        const value = Number(wager);
        if (wager === null || wager === '' || !Number.isFinite(value)) {
            return null;
        }
        return Math.min(Math.max(0, Math.round(value)), Math.max(0, max));
    }

    /**
     * The wagers of a state, without what isn't a number
     */
    public static completeWagers(wagers: unknown): Record<string, number> {
        const complete: Record<string, number> = {};
        if (wagers != null && typeof wagers === 'object') {
            for (const [teamId, wager] of Object.entries(wagers)) {
                if (typeof wager === 'number' && Number.isFinite(wager)) {
                    complete[teamId] = wager;
                }
            }
        }
        return complete;
    }

    /**
     * Correct and double answers win the wager, wrong ones lose it
     */
    public static getPoints(wager: number | undefined, isCorrect: boolean): number {
        return (isCorrect ? 1 : -1) * (wager ?? 0);
    }
}
