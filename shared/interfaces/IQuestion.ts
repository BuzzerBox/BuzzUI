import {IAnswer, IMediaDetails, IMediaQuestionState} from '../shared';

export interface IQuestion {
    text: string;
    answers: IAnswer[];
    show: boolean;
    mediaDetails?: IMediaDetails;
    initialConfig?: IMediaQuestionState;
}
