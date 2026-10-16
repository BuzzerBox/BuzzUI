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
    /**
     * What a correct answer is worth. Missing means 1 point, as in savegames from before it existed.
     */
    points?: number;
}
