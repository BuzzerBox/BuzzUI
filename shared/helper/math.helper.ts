export class MathHelper {
    private constructor() {
        // hide
    }

    /**
     * Checking if i ∈ [boundary1, boundary2] iff boundary1 ≤ boundary2 or i ∈ [boundary2, boundary1] otherwise
     */
    public static isInRangeInclusive(element: any, boundary1: number, boundary2: number): boolean {
        const i = Number(element);
        return Math.min(boundary1, boundary2) <= i && i <= Math.max(boundary1, boundary2)
    }

    /**
     * Checking if i ∈ (boundary1, boundary2) iff boundary1 ≤ boundary2 or i ∈ (boundary2, boundary1) otherwise
     */
    public static isInRangeExclusive(element: any, boundary1: number, boundary2: number): boolean {
        const i = Number(element);
        return Math.min(boundary1, boundary2) < i && i < Math.max(boundary1, boundary2)
    }
}
