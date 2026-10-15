/**
 * An update bundle (buzzerbox-update-<version>.tar) the server found on a USB stick
 */
export interface IUpdateBundle {
    /**
     * Path of the bundle relative to the directory the server looks for bundles in. The master sends it back to
     * install the bundle.
     */
    fileName: string;
    /**
     * The version from the file name. The installation checks it against the signed manifest inside the bundle.
     */
    version: string;
    /**
     * Whether the version is newer than the installed one
     */
    isNewer: boolean;
}
