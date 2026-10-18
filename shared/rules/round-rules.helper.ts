import {IRound, TRoundMode} from '../interfaces/IRound';
import {IRoundRules} from './round-rules';
import {ClassicRoundRules} from './classic-round-rules';
import {JeopardyRoundRules} from './jeopardy-round-rules';
import {FinalRoundRules} from './final-round-rules';

export class RoundRulesHelper {
    private static readonly RULES: Record<TRoundMode, IRoundRules> = {
        classic: new ClassicRoundRules(),
        jeopardy: new JeopardyRoundRules(),
        final: new FinalRoundRules()
    };

    private constructor() {
        // hide public constructor
    }

    public static isSupportedMode(mode: unknown): mode is TRoundMode {
        return typeof mode === 'string' && Object.prototype.hasOwnProperty.call(this.RULES, mode);
    }

    /**
     * Whether the round has a mode this version can play, and everything that mode needs
     */
    public static isSupportedRound(round: unknown): boolean {
        const mode = (round as Partial<IRound>)?.mode;
        return round != null && typeof round === 'object' && this.isSupportedMode(mode) && this.RULES[mode].isWellFormed(round);
    }

    /**
     * The rules of Jeopardy rounds, with the board's own moves
     */
    public static get jeopardy(): JeopardyRoundRules {
        return this.RULES.jeopardy as JeopardyRoundRules;
    }

    /**
     * The rules of the final, with its wagers
     */
    public static get final(): FinalRoundRules {
        return this.RULES.final as FinalRoundRules;
    }

    /**
     * The rules the round is played by
     */
    public static get(round: IRound): IRoundRules {
        const rules = this.RULES[round?.mode];
        if (rules == null) {
            throw new Error(`Unknown round mode ${round?.mode}`);
        }
        return rules;
    }
}
