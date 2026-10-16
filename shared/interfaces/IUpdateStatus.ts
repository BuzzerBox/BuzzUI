import {EUpdateStates} from '../shared';

export interface IUpdateStatus {
    state: EUpdateStates;
    /**
     * The version that is being or was installed
     */
    version?: string;
    message?: string;
    /**
     * When the state was last changed, as an ISO date
     */
    time: string;
}
