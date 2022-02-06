import {StringHelper} from './string.helper';

export class EnumHelper {
    private constructor() {
        // hide
    }

    public static extractStringRepresentationsFromEnum(_enum: any): string[] {
        const extracted: string[] = [];
        for (const e in _enum) {
            if (StringHelper.isString(e, true)) {
                // if it is not a number, then it is a string rep
                extracted.push(e.toString());
            }
        }
        return extracted;
    }
}
