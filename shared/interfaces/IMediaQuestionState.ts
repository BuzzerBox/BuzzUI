import {EMediaStates, EQuestionAnswerStates} from '../shared';

export interface IMediaQuestionState {
    mediaState: EMediaStates | undefined;
    questionState: EQuestionAnswerStates | undefined;
    answerState: EQuestionAnswerStates | undefined;
}
