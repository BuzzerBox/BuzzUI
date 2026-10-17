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

/**
 * The kinds of media a question can show, which offer different initial states: only media that end (video, audio and
 * slideshows) let the question and answers wait for them
 */
export type TMediaKind = 'image' | 'playable' | 'slideshow';

/**
 * How the questions of a game start, for each kind of media. A question's own initialConfig overrides it.
 */
export type IMediaQuestionDefaults = Record<TMediaKind, IMediaQuestionState>;
