export class ObjectHelper {
    private constructor() {
        // hide constructor
    }

    public static ensureNotNull(...objects: Object[]): void {
        for (const obj of objects) {
            this.ensureNotNullImpl(obj);
        }
    }

    private static ensureNotNullImpl(obj: Object): void {
        if (obj === null || obj === undefined) {
            throw new Error("Object is Null but ought not to!");
        }
    }
}
