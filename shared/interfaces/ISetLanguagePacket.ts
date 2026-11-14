import {IGamePacket} from './IGamePacket';
import {EPacketTypes} from '../enums/EPacketTypes';

/**
 * Sent from the master when it registers and whenever its language is changed, and passed on by the server to the
 * screens (also to one that registers later), which show their texts in that language
 */
export interface ISetLanguagePacket extends IGamePacket {
    packetType: EPacketTypes.SET_LANGUAGE;
    /** One of LanguageHelper.LANGUAGES */
    language: string;
}
