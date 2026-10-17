import {IGamePacket, EPacketTypes} from '../shared';
import {EGradeResults} from '../enums/EGradeResults';
import {IAnswer} from './IAnswer';

/**
 * Sent by the master to grade the answer of the team that buzzed. The server awards the points and forwards the
 * packet to the screens and the master, which flash the answers red for a wrong one.
 */
export interface IGradeAnswerPacket extends IGamePacket {
    packetType: EPacketTypes.GRADE_ANSWER;
    teamId: string;
    result: EGradeResults;
    /**
     * Whether the screens show the answer options, so a correct answer lights up there
     */
    revealCorrectAnswers: boolean;
    /**
     * The answer option the team gave, if the master picked it. It lights up instead of the correct answers: green if
     * it is correct, red if not.
     */
    answer?: IAnswer;
}
