import {EMediaStates, EQuestionAnswerStates} from '../shared';

export interface IMediaQuestionState {
    mediaState: EMediaStates | undefined;
    questionState: EQuestionAnswerStates | undefined;
    answerState: EQuestionAnswerStates | undefined;
    fullscreen?: boolean;
    /**
     * Only for slideshows: the image that is shown, starting at 0
     */
    slideIndex?: number;
}
