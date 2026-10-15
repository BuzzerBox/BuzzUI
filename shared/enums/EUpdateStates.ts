/**
 * The state of the last update, as the update helper on the box writes it to its status file. The values are strings
 * since that file is written by a shell script.
 */
export enum EUpdateStates {
    RUNNING = 'running',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed',
    /**
     * The new version was installed but did not start, so the previous one runs again
     */
    ROLLED_BACK = 'rolled-back'
}
