import {IAnswer, IAnswerSetStatePacket, IGameState, IMarkTeamPacket, IQuestion} from "../interfaces";
import {EAnswerStates} from "../enums/EAnswerStates";

/**
 * Keeps the progress within the current question (marked teams, logged in and activated answers) in the game state, so
 * screens and masters that (re)connect can show it again.
 */
export class GameStateHelper {
    private constructor() {
        // hide public constructor
    }

    /**
     * Answers travel as JSON, so they are compared by content, not by reference
     */
    public static isSameAnswer(a: IAnswer, b: IAnswer): boolean {
        return a.text === b.text && a.isCorrect === b.isCorrect;
    }

    public static applyMarkTeam(gameState: IGameState, packet: IMarkTeamPacket): void {
        const marked = (gameState.markedTeamIds ?? []).filter(id => id !== packet.teamId);
        if (packet.unmarkAll) {
            gameState.markedTeamIds = [];
        } else {
            gameState.markedTeamIds = packet.mark ? [...marked, packet.teamId] : marked;
        }
    }

    public static applyAnswerState(gameState: IGameState, packet: IAnswerSetStatePacket): void {
        const loggedAnswers = (gameState.loggedAnswers ?? []).filter(a => !this.isSameAnswer(a, packet.answer));
        const activatedAnswers = gameState.activatedAnswers ?? [];
        if (packet.state === EAnswerStates.LOG_IN) {
            loggedAnswers.push(packet.answer);
        } else if (packet.state === EAnswerStates.ACTIVATE && !activatedAnswers.some(a => this.isSameAnswer(a, packet.answer))) {
            gameState.activatedAnswers = [...activatedAnswers, packet.answer];
        }
        gameState.loggedAnswers = loggedAnswers;
    }

    /**
     * Forgets the progress within the question, e.g. when switching to another one
     */
    public static resetQuestionProgress(gameState: IGameState): void {
        gameState.markedTeamIds = [];
        gameState.loggedAnswers = [];
        gameState.activatedAnswers = [];
    }

    public static areAllCorrectAnswersActivated(gameState: IGameState, question: IQuestion): boolean {
        const correctAnswers = (question?.answers ?? []).filter(a => a.isCorrect);
        return correctAnswers.length > 0
            && correctAnswers.every(c => (gameState.activatedAnswers ?? []).some(a => this.isSameAnswer(a, c)));
    }
}
