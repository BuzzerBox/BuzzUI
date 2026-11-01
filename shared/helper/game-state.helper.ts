import {IAnswer, IAnswerSetStatePacket, IGameState, IMarkTeamPacket, IQuestion, ISetupPacket} from "../interfaces";
import {EAnswerStates} from "../enums/EAnswerStates";
import {ScoringHelper} from "./scoring.helper";

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

    /**
     * What a game's setup adds to its state, the same on the server and the master: the theme, the scoring of the
     * game's version (a continued state keeps its own if the setup has none), the welcome screen of a new play (a
     * continued one is where it was) and the game's name
     */
    public static applySetup(gameState: IGameState,
                             setup: Pick<ISetupPacket, 'currentGameState' | 'isNewState' | 'storage' | 'themeId' | 'scoring'>): void {
        if (setup.themeId) {
            gameState.themeId = setup.themeId;
        }
        gameState.scoring = ScoringHelper.complete(setup.scoring ?? gameState.scoring);
        if (setup.isNewState && setup.currentGameState == null) {
            gameState.welcome = true;
        }
        if (setup.storage?.gameName) {
            gameState.gameName = setup.storage.gameName;
        }
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
