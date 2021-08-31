import {EKeyBinds} from '../shared';

export interface IBuzzer {
    id: string;
    name?: string;
    keyBind: string;
    byteBind: string;
}
