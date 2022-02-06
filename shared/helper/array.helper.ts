export class ArrayHelper {
    private constructor() {
        // hide
    }

    public static isArray(x: any): boolean {
        return Array.isArray(x);
    }

    public static removeObject<T>(array: T[], object: T): void {
        const index = array.indexOf(object, 0);
        if (index > -1) {
            array.splice(index, 1);
        }
    }
}
