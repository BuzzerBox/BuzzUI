import * as inquirer from 'inquirer';
import {RawData, WebSocket} from 'ws';
import {
    ArrayHelper,
    EAnswerStates, EnumHelper,
    EVideoStates,
    IEndGamePacket,
    IGamePacket,
    IMarkTeamPacket,
    IResetServerPacket,
    ISetQuestionPacket,
    IStartGamePacket,
    ITeamSetPointsPacket,
    IUpdateMediaStatePacket,
    MathHelper,
    PacketHelper, ServerConsoleHelper, StringHelper, WebsocketConnection
} from '../shared/shared';
import Separator = require('inquirer/lib/objects/separator');
import {Buffer} from 'buffer';

// enum EPossibleGamePackets {
//     "IGamePacket",
//     "IRegisterScreenPacket",
//     "INewMasterAccepted",
//     "ISetupPacket",
//     "IKeypressOnScreenPacket",
//     "ISetBuzzerLockPacket",
//     "IResponsePacket",
//     "IRegisterMasterPacket",
//     "IAnswerSetStatePacket",
//     "IDataForScreenPacket",
//     "IMarkTeamPacket (mark or unmark a team)",
//     "IMarkTeamPacket (unmark all teams)",
//     "ISetQuestionPacket",
//     "IStartGamePacket",
//     "IResetServerPacket",
//     "IEndGamePacket",
//     "ITeamSetPointsPacket",
//     "IUpdateMediaStatePacket"
// }

enum EPossibleGamePackets {
    "IGamePacket",
    "IRegisterScreenPacket",
    "IKeypressOnScreenPacket",
    "ISetBuzzerLockPacket",
    "IResponsePacket",
    "IRegisterMasterPacket",
    "IAnswerSetStatePacket",
    "IMarkTeamPacket (mark or unmark a team)",
    "IMarkTeamPacket (unmark all teams)",
    "ISetQuestionPacket",
    "IStartGamePacket",
    "IResetServerPacket",
    "IEndGamePacket",
    "ITeamSetPointsPacket",
    "IUpdateMediaStatePacket"
}

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

export class WebsocketTestApp {
    private static _instance: WebsocketTestApp = null;
    // private websocketConnection: WebSocket = null;
    private websocketConnection: WebsocketConnection = null;


    private constructor() {
        this._run();
    }

    public static run(): void {
        if (this._instance == null) {
            this._instance = new WebsocketTestApp();
        }
    }

    private _run(): void {
        this.connectToWebsocket();
    }

    private async connectToWebsocket(): Promise<void> {
        const choicesProtocol = ["ws", "wss"];
        const answers = await ServerConsoleHelper.prompt(
          ServerConsoleHelper.QuestionsMaker.list("protocol", "Which protocol shall be used?", choicesProtocol, false, choicesProtocol[0]),
          ServerConsoleHelper.QuestionsMaker.input("hostname", "Which is the hostname that shall be connected to?", "localhost"),
          ServerConsoleHelper.QuestionsMaker.number("port", "What port shall be used?", 6666)
        )

        this.websocketConnection = WebsocketConnection.connect(answers.hostname, answers.port, answers.protocol);
        this.websocketConnection.onMessageCb(this.onMessage.bind(this));
        this.websocketConnection.onCloseCb(this.onConnectionClose.bind(this));
        this.websocketConnection.onErrorCb(this.onError.bind(this));

        this.promptSendPacketPossibilities();
    }

    private async promptSendPacketPossibilities(): Promise<void> {
        const possibleOptionsForSend: string[] = EnumHelper.extractStringRepresentationsFromEnum(EPossibleGamePackets);
        const choices = ([
            "plain string",
        ]
          .concat(possibleOptionsForSend) as (string | Separator)[])
          .concat(new inquirer.Separator());
        const answers = await ServerConsoleHelper.prompt(ServerConsoleHelper.QuestionsMaker.list('sendPacket', "What would you like to send?", choices))
        this.handleSendPaketDecision(answers.sendPacket);
    }

    private sendString(s: string): void {
        console.log("Sending string '%s' to websocket server", s);
        this.websocketConnection.send(s);
    }

    private sendJSO<T = Object>(jso: T): void {
        console.log("Sending the following JSO to all active connections:\n%s", `\n${JSON.stringify(jso, null, "  ")}\n`);
        this.sendString(JSON.stringify(jso));
    }

    private async handleSendPaketDecision(decision: string): Promise<void> {
        let answers = null;

        if (decision == 'plain string') {
            answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'plainString',
                    message: "Please enter your plain string"
                }
            ]);
            this.sendString(answers['plainString']);
            this.promptSendPacketPossibilities();
            return;
        }
        const gamePacket: EPossibleGamePackets = EPossibleGamePackets[decision];

        switch (gamePacket) {
            case EPossibleGamePackets.IGamePacket:
                this.sendJSO<IGamePacket>({
                    packetType: -1
                })
                break;
            case EPossibleGamePackets.IRegisterScreenPacket:
                answers = ServerConsoleHelper.prompt(ServerConsoleHelper.QuestionsMaker.input('screenId', "Please enter the screen ID"))
                const registerScreenPacket = PacketHelper.makeRegisterScreenPacket(answers.screenId);
                this.sendJSO(registerScreenPacket);
                break;
            case EPossibleGamePackets.IKeypressOnScreenPacket:
                console.info("This packet is obsolete and will be removed soon! Thus, this is not implemented.");
                break;
            case EPossibleGamePackets.ISetBuzzerLockPacket:
                const setLock = await this.promptSingleConfirmQuestion("Do you want to lock the buzzers?");
                this.sendJSO(PacketHelper.makeBuzzerLockPacket(setLock));
                break;
            case EPossibleGamePackets.IRegisterMasterPacket:
                PacketHelper.makeRegisterMasterPacket()
                break;
            case EPossibleGamePackets.IAnswerSetStatePacket:
                // TODO use function to extract from enum directly
                const logInAnswer = "Log in answer";
                const logOutAnswer = "Log out answer";
                const activateAnswer = "Activate answer";

                answers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'answerState',
                        message: "Which state shall be set?",
                        choices: [
                            logInAnswer,
                            logOutAnswer,
                            activateAnswer
                        ]
                    }, {
                        type: 'input',
                        name: 'answerText',
                        message: "Enter the answer's text:"
                    }, {
                        type: 'confirm',
                        name: 'isAnswerCorrect',
                        message: 'Is the answer a correct answer?'
                    }
                ]);

                const getAnswerState: () => EAnswerStates = () => {
                    switch (answers['answerState']) {
                        case logInAnswer:
                            return EAnswerStates.LOG_IN;
                        case logOutAnswer:
                            return EAnswerStates.LOG_OUT;
                        case activateAnswer:
                            return EAnswerStates.ACTIVATE;
                        default:
                            return null;
                    }
                };
                const answerText: string = answers['answerText'];
                const isAnswerCorrect: boolean = Boolean(answers['isAnswerCorrect']).valueOf();
                this.sendJSO(PacketHelper.makeAnswerSetSatePacket(getAnswerState(), {
                    text: answerText,
                    isCorrect: isAnswerCorrect
                }));

                break;
            case EPossibleGamePackets['IMarkTeamPacket (mark or unmark a team)']:
                answers = await inquirer.prompt([
                    {
                        type: 'number',
                        name: 'teamId',
                        message: "Which team shall be marked?"
                    }, {
                        type: 'confirm',
                        name: 'isMarked',
                        message: "Shall the team be marked?"
                    }
                ]);
                this.sendJSO<IMarkTeamPacket>(PacketHelper.makeMarkTeamPacket(answers['teamId'], answers['isMarked']));
                break;
            case EPossibleGamePackets['IMarkTeamPacket (unmark all teams)']:
                this.sendJSO<IMarkTeamPacket>(PacketHelper.makeUnmarkAllTeamsPacket());
                break;
            case EPossibleGamePackets.ISetQuestionPacket:
                answers = await inquirer.prompt([
                    {
                        type: 'number',
                        name: 'questionNumber',
                        message: 'Which question (its number) shall be set?'
                    }
                ]);
                this.sendJSO<ISetQuestionPacket>(PacketHelper.makeSetQuestionPacket(answers['questionNumber']));
                break;
            case EPossibleGamePackets.IStartGamePacket:
                this.sendJSO<IStartGamePacket>(PacketHelper.makeStartGamePacket());
                break;
            case EPossibleGamePackets.IResetServerPacket:
                this.sendJSO<IResetServerPacket>(PacketHelper.makeResetServerPacket());
                break;
            case EPossibleGamePackets.IEndGamePacket:
                this.sendJSO<IEndGamePacket>(PacketHelper.makeEndGamePacket());
                break;
            case EPossibleGamePackets.ITeamSetPointsPacket:
                answers = await inquirer.prompt([
                    ServerConsoleHelper.QuestionsMaker.number('teamId', 'Set the points for which team (team id)?', 0),
                    ServerConsoleHelper.QuestionsMaker.number('points', 'How many points shall the team have?', 0)
                ]);
                this.sendJSO<ITeamSetPointsPacket>(PacketHelper.makeTeamSetPointsPacket(answers['points'], answers['teamId']));
                break;
            case EPossibleGamePackets.IUpdateMediaStatePacket:
                answers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'mediaState',
                        message: "Set the media's state",
                        choices: EnumHelper.extractStringRepresentationsFromEnum(EVideoStates)
                    },
                    ServerConsoleHelper.QuestionsMaker.number('timestamp', "Set the timestamp:", 0)
                ])
                this.sendJSO<IUpdateMediaStatePacket>(PacketHelper.makeUpdateMediaStatePacket(Number(EVideoStates[answers['mediaState']]), answers['timestamp']))
                break;
            default:
                  break;
        }

        // subsequent actions
        this.promptSendPacketPossibilities();
    }

    // TODO remove
    private promptSingleConfirmQuestion(message: string): Promise<boolean> {
        return inquirer.prompt([
            ServerConsoleHelper.QuestionsMaker.confirm("singleQuestion", message)
        ]).then(answers => {
            return answers['singleQuestion'];
        })
    }



    // private async prompt<T extends {[key: string]: boolean | string | number} = {}>(questions: IBaseQuestion | IBaseQuestion[], answersDefinition: T, answersProcessor?: (answers: T) => any): Promise<void | T> {
    //     let q: IBaseQuestion[] = null;
    //     if (ArrayHelper.isArray(questions)) {
    //         q = questions as IBaseQuestion[];
    //     } else {
    //         q = [questions as IBaseQuestion];
    //     }
    //     const rawAnswerObject = await inquirer.prompt(q);
    //     let processedAnswers: T = null;
    //
    //     for (const key in answersDefinition) {
    //         console.log("key", key);
    //     }
    //
    //     // if no processor function (callback) is given, return the processed answers
    // }



    private pizzaDemo(): void {
        console.log('Hi, welcome to Node Pizza');

        const questions = [
            {
                type: 'confirm',
                name: 'toBeDelivered',
                message: 'Is this for delivery?',
                default: false,
            },
            {
                type: 'input',
                name: 'phone',
                message: "What's your phone number?",
                validate(value) {
                    const pass = value.match(
                      /^([01]{1})?[-.\s]?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\s?((?:#|ext\.?\s?|x\.?\s?){1}(?:\d+)?)?$/i
                    );
                    if (pass) {
                        return true;
                    }

                    return 'Please enter a valid phone number';
                },
            },
            {
                type: 'list',
                name: 'size',
                message: 'What size do you need?',
                choices: ['Large', 'Medium', 'Small'],
                filter(val) {
                    return val.toLowerCase();
                },
            },
            {
                type: 'input',
                name: 'quantity',
                message: 'How many do you need?',
                validate(value) {
                    const valid = !isNaN(parseFloat(value));
                    return valid || 'Please enter a number';
                },
                filter: Number,
            },
            {
                type: 'expand',
                name: 'toppings',
                message: 'What about the toppings?',
                choices: [
                    {
                        key: 'p',
                        name: 'Pepperoni and cheese',
                        value: 'PepperoniCheese',
                    },
                    {
                        key: 'a',
                        name: 'All dressed',
                        value: 'alldressed',
                    },
                    {
                        key: 'w',
                        name: 'Hawaiian',
                        value: 'hawaiian',
                    },
                ],
            },
            {
                type: 'rawlist',
                name: 'beverage',
                message: 'You also get a free 2L beverage',
                choices: ['Pepsi', '7up', 'Coke'],
            },
            {
                type: 'input',
                name: 'comments',
                message: 'Any comments on your purchase experience?',
                default: 'Nope, all good!',
            },
            {
                type: 'list',
                name: 'prize',
                message: 'For leaving a comment, you get a freebie',
                choices: ['cake', 'fries'],
                when(answers) {
                    return answers.comments !== 'Nope, all good!';
                },
            },
        ];

        inquirer.prompt(questions).then((answers) => {
            console.log('\nOrder receipt:');
            console.log(JSON.stringify(answers, null, '  '));
        });
    }

    private onMessage(data: RawData, isBinary: boolean): void {
        console.log("Got message: %s", data.toString());
    }

    private onConnectionClose(code?: number, reason?: Buffer): void {
        console.log("Connection to the server was closed with code '%n' and reason ", code);
        console.log(reason.toString(), "\n");

        console.log('Resetting client to make new connection...');
        this.resetAppState();
    }

    private onError(err?: Error): void {
        console.log("An error occured: ", err);
    }

    private resetAppState(): void {
        WebsocketTestApp._instance = null;
        WebsocketTestApp.run();
    }

}

WebsocketTestApp.run();
