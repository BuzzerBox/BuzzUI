import {IRound, TRoundMode} from '../interfaces/IRound';
import {IRoundRules} from './round-rules';
import {ClassicRoundRules} from './classic-round-rules';

export class RoundRulesHelper {
    private static readonly RULES: Record<TRoundMode, IRoundRules> = {
        classic: new ClassicRoundRules()
    };

    private constructor() {
        // hide public constructor
    }

    public static isSupportedMode(mode: unknown): mode is TRoundMode {
        return typeof mode === 'string' && Object.prototype.hasOwnProperty.call(this.RULES, mode);
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
