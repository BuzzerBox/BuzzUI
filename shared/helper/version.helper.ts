export class VersionHelper {
    private constructor() {
        // hide
    }

    /**
     * Compares two versions like "1.10.2" part by part. Parts that are not numbers (e.g. in "1.2.0-beta") are compared
     * as text.
     * @return a negative number if a is older than b, a positive one if it is newer and 0 if both are the same
     */
    public static compare(a: string, b: string): number {
        const partsA = a.split(/[.+-]/);
        const partsB = b.split(/[.+-]/);
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const partA = partsA[i] ?? '0';
            const partB = partsB[i] ?? '0';
            const numberA = Number(partA);
            const numberB = Number(partB);
            const result = isNaN(numberA) || isNaN(numberB) ? partA.localeCompare(partB) : numberA - numberB;
            if (result !== 0) {
                return result;
            }
        }
        return 0;
    }
}
