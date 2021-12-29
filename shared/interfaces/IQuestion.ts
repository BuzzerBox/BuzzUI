import {IAnswer, IMediaDetails} from '../shared';

export interface IQuestion {
    text: string;
    answers: IAnswer[];
    show: boolean;
    mediaDetails?: IMediaDetails;
}
