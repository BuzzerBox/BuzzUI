import {IAnswer} from '../shared';

export interface IQuestion {
    text: string;
    answers: IAnswer[];
    show: boolean;
}
