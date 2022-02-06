
// TODO get @hexxag0nal/ts-utils-collection to fucking work here in angular environment

export class StringHelper {
    private constructor() {
        // hide
    }

    isLastChar = function (s: string, c: string): boolean {
        return c.length === 1 && s.charAt(s.length - 1) === c;
    }

    public static isFirstChar = function (s: string, c: string): boolean {
        return c.length === 1 && s.charAt(0) === c;
    }

    public static equals = function (s: string, otherString: string, ...otherStrings: string[]): boolean {
        const isEqualImpl = (s_: string) => s === s_;

        // if (this !== otherString) {
        if (!isEqualImpl(otherString)) {
            return false;
        }
        for (const s of otherStrings) {
            if (!isEqualImpl(s)) {
                return false;
            }
        }
        return true;
    }

    public static isEmpty = function (s: string): boolean {
        return StringHelper.equals(s.toString().trim(), "");
    }

    public static append = function (s: string, appendix: string): string {
        return s.concat(appendix);
    }

    public static prepend = function (s: string, prependix: string): string {
        return prependix + s;
    }

    public static appendIf = function (s: string, appendix: string, predicate: boolean): string {
        return predicate ? StringHelper.append(s, appendix) : s;
    }

    public static prependIf = function (s: string, prependix: string, predicate: boolean): string {
        return predicate ? StringHelper.prepend(s, prependix) : s;
    }

    public static appendWithInfixIf = function (s: string, appendix: string, infix: string, predicate: boolean): string {
        return StringHelper.append(s, StringHelper.prependIf(appendix, infix, predicate));
    }

    public static removeChars = function (s: string, atBeginning: number | null, atEnd: number | null): string {
        let tmp = s;
        if (atBeginning != null) {
            tmp = tmp.slice(atBeginning, tmp.length);
        }
        if (atEnd != null) {
            tmp = tmp.slice(0, tmp.length - atEnd);
        }
        return tmp;
    }

    public static isBlank(s: string): boolean {
        s = s.toString();
        return s == null || this.isEmpty(s);
    }

    public static isNotBlank(s: string): boolean {
        return !this.isBlank(s);
    }

    public static isNumber(s: string): boolean {
        return this.isNotBlank(s) && !isNaN(Number(s));
    }

    public static isString(s: any, avoidNumber: boolean = false): boolean {
        return (!avoidNumber || !this.isNumber(s)) && typeof s == 'string';
    }
}
