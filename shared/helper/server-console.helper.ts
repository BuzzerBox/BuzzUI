import {StringHelper} from './string.helper';
import {Answers} from 'inquirer';
import Separator = require('inquirer/lib/objects/separator');
import * as inquirer from 'inquirer';

enum EQuestionTypes {
    NUMBER,
    INPUT,
    CONFIRM,
    LIST
}

interface IBaseQuestion {
    type: 'number' | 'input' | 'confirm' | 'list';
    name: string;
    message?: string;
    default?: string | number | boolean;
    _type: EQuestionTypes; // this one determines the true nature of the question. Necessary since we use 'input' for NUMBER questions (due to some validation issues)
}

export class ServerConsoleHelper {
    private constructor() {
        // hide
    }

    public static QuestionsMaker = class {
        public static confirm(name: string, message: string, defaultInput?: boolean): IBaseQuestion & {
            type: 'confirm';
            default?: boolean;
            _type: EQuestionTypes.CONFIRM
        } {
            return {
                type: 'confirm',
                name,
                message,
                default: defaultInput,
                _type: EQuestionTypes.CONFIRM
            }
        }

        /**
         * number validation has issues, so we use the type 'input'
         * @param validator A custom validator that will be run as well if supplied
         */
        public static number<T extends Answers = Answers>(name: string, message?: string, defaultInput?: number, validator?: (input: any, answers?: T) => boolean | string | Promise<boolean | string>): IBaseQuestion & {
            type: 'input';
            validate: (input: any, answers?: T) => boolean | string | Promise<boolean | string>;
            default?: number;
            _type: EQuestionTypes.NUMBER;
        } {
            return {
                type: 'input',
                name,
                message,
                validate: async (input, answers?: T) => {
                    // check if user input is a number
                    if (StringHelper.isNumber(input)) {
                        // if a custom validator was supplied, run it as well
                        if (validator != null) {
                            return validator(input, answers);
                        } else {
                            return true;
                        }
                    } else {
                        return "Please enter a valid number";
                    }
                },
                default: defaultInput,
                _type: EQuestionTypes.NUMBER
            }
        }

        public static list(name: string, message: string, choices: (string | Separator)[], addGoBackChoice: boolean = false, defaultInput?: string): IBaseQuestion & {
            type: 'list';
            choices: (string | Separator)[];
            default?: string;
            message: string;
            _type: EQuestionTypes.LIST;
        } {
            return {
                type: 'list',
                default: defaultInput,
                name,
                message,
                choices: choices,
                _type: EQuestionTypes.LIST
            }
        }

        public static input(name: string, message?: string, defaultInput?: string): IBaseQuestion & {
            type: 'input';
            _type: EQuestionTypes.INPUT;
        } {
            return {
                type: 'input',
                name,
                message,
                default: defaultInput,
                _type: EQuestionTypes.INPUT
            }
        }
    }

    public static async prompt<T extends Answers = Answers>(...questions: IBaseQuestion[]): Promise<T> {
        return inquirer.prompt<T>(questions);
    }
}
