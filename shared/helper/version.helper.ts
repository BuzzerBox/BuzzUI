export class VersionHelper {
    private constructor() {
        // hide
    }

    /**
     * Compares two versions by the rules of Semantic Versioning: "1.10.2" part by part, a pre-release such as
     * "1.2.0-beta.2" is older than "1.2.0", and build metadata after "+" is ignored. Parts that are not numbers are
     * compared as text, so versions that don't follow the rules still get an order.
     * @return a negative number if a is older than b, a positive one if it is newer and 0 if both are the same
     */
    public static compare(a: string, b: string): number {
        const versionA = VersionHelper.parse(a);
        const versionB = VersionHelper.parse(b);
        for (let i = 0; i < Math.max(versionA.release.length, versionB.release.length); i++) {
            const result = VersionHelper.compareParts(versionA.release[i] ?? '0', versionB.release[i] ?? '0');
            if (result !== 0) {
                return result;
            }
        }
        // a version without pre-release is newer than its pre-releases
        if (versionA.preRelease.length === 0 || versionB.preRelease.length === 0) {
            return versionB.preRelease.length - versionA.preRelease.length;
        }
        for (let i = 0; i < Math.min(versionA.preRelease.length, versionB.preRelease.length); i++) {
            const result = VersionHelper.compareParts(versionA.preRelease[i], versionB.preRelease[i]);
            if (result !== 0) {
                return result;
            }
        }
        // "beta" is older than "beta.1"
        return versionA.preRelease.length - versionB.preRelease.length;
    }

    private static parse(version: string): {release: string[], preRelease: string[]} {
        const withoutBuild = version.split('+')[0];
        const dash = withoutBuild.indexOf('-');
        return dash < 0
            ? {release: withoutBuild.split('.'), preRelease: []}
            : {release: withoutBuild.slice(0, dash).split('.'), preRelease: withoutBuild.slice(dash + 1).split('.')};
    }

    /**
     * Numbers are compared as numbers and are older than text
     */
    private static compareParts(a: string, b: string): number {
        const isNumberA = /^\d+$/.test(a);
        const isNumberB = /^\d+$/.test(b);
        if (isNumberA && isNumberB) {
            return Number(a) - Number(b);
        }
        if (isNumberA !== isNumberB) {
            return isNumberA ? -1 : 1;
        }
        return a < b ? -1 : a > b ? 1 : 0;
    }
}
