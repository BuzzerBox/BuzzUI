import {IAnswer, IMediaDetails, IMediaQuestionState} from '../shared';

export interface IQuestion {
    text: string;
    answers: IAnswer[];
    show: boolean;
    mediaDetails?: IMediaDetails;
    initialConfig?: IMediaQuestionState;
    /**
     * Notes for the game master, like presenter notes. Only the master sees them, they are not sent to screens.
     */
    notes?: string;
}
