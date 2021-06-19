import {IGamePacket, EPacketTypes, ITeam} from '../shared';

export interface ISetBuzzerLockPacket extends IGamePacket {
    packetType: EPacketTypes.SET_BUZZER_LOCK;
    setLock: boolean;
}
