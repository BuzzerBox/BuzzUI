import {CURRENT_GAME_FORMAT_VERSION, IGameDefinition, IGameInstanceState} from '../interfaces/IGameDefinition';
import {IGameState} from '../interfaces/IGameState';
import {IQuestion} from '../interfaces/IQuestion';
import {IClassicRound, IFinalRound, IGameProgress, IJeopardyCategory, IJeopardyRound, IJeopardyRoundProgress, IRound, IRoundProgress} from '../interfaces/IRound';
import {RoundRulesHelper} from '../rules/round-rules.helper';

/**
 * A game version as it was saved before it had rounds (format 4 and older)
 */
interface ILegacyGameDefinition extends Omit<IGameDefinition, 'rounds'> {
    questions: IQuestion[];
}

/**
 * A game state as it was saved before games had rounds
 */
interface ILegacyGameState extends Omit<IGameState, 'currentRoundId' | 'roundProgress'> {
    currentQuestionNumber?: number;
}

/**
 * Brings game versions and states of older formats into the current one (see CURRENT_GAME_FORMAT_VERSION), and finds
 * the rounds and questions of a game. Files are never rewritten: they are migrated each time they are loaded, the same
 * way, so the IDs a version gets stay the same.
 */
export class GameFormatHelper {
    /**
     * The one round a game from before rounds becomes
     */
    public static readonly LEGACY_ROUND_ID = 'round-1';

    private constructor() {
        // hide public constructor
    }

    public static makeRoundName(index: number): string {
        return `Runde ${index + 1}`;
    }

    /**
     * A game version as it is read from a file or a bundle, in the current format; null if it isn't one, or has a round
     * this version can't play (e.g. from a newer version)
     */
    public static migrateDefinition(json: unknown): IGameDefinition | null {
        const definition = json as Partial<IGameDefinition & ILegacyGameDefinition>;
        if (definition?.kind !== 'game') {
            return null;
        }
        let rounds: unknown[];
        if (Array.isArray(definition.rounds)) {
            rounds = definition.rounds;
        } else if (Array.isArray(definition.questions)) {
            rounds = [this.makeClassicRound(this.LEGACY_ROUND_ID, this.makeRoundName(0), definition.questions)];
        } else {
            return null;
        }
        const checkedRounds = this.checkRounds(rounds);
        if (checkedRounds == null) {
            return null;
        }
        const {questions, ...rest} = definition;
        return {...rest, formatVersion: CURRENT_GAME_FORMAT_VERSION, rounds: checkedRounds} as IGameDefinition;
    }

    /**
     * The rounds, if they all can be played, with an ID for every round and question that lacks one (or has the ID of
     * another); null otherwise
     */
    public static checkRounds(rounds: unknown): IRound[] | null {
        if (!Array.isArray(rounds) || !rounds.every(round => this.isSupportedRound(round))) {
            return null;
        }
        const roundIds = new Set<string>();
        const questionIds = new Set<string>();
        const makeUnique = (id: unknown, fallback: string, used: Set<string>): string => {
            let unique = typeof id === 'string' && id !== '' && !used.has(id) ? id : fallback;
            for (let i = 2; used.has(unique); i++) {
                unique = `${fallback}-${i}`;
            }
            used.add(unique);
            return unique;
        };
        return (rounds as IRound[]).map((round, roundIndex) => {
            const id = makeUnique(round.id, `round-${roundIndex + 1}`, roundIds);
            const name = typeof round.name === 'string' && round.name.trim() !== '' ? round.name : this.makeRoundName(roundIndex);
            const withId: IRound = {...round, id, name};
            let questionIndex = 0;
            // the IDs that changed in this round, by the one the question had first, unless a question of the round kept it
            const renamed = new Map<string, string>();
            const kept = new Set<string>();
            const checked = RoundRulesHelper.get(withId).mapQuestions(withId, question => {
                // the IDs of a version from before are their places, so they are the same every time it is loaded
                const fallback = id === this.LEGACY_ROUND_ID ? `question-${++questionIndex}` : `${id}-question-${++questionIndex}`;
                const unique = makeUnique(question.id, fallback, questionIds);
                if (question.id === unique) {
                    kept.add(unique);
                } else if (typeof question.id === 'string' && !kept.has(question.id) && !renamed.has(question.id)) {
                    renamed.set(question.id, unique);
                }
                return {...question, id: unique};
            });
            return checked.mode === 'jeopardy' ? this.checkDailyDoubles(checked, renamed) : checked;
        });
    }

    /**
     * The Daily Doubles of a board whose question IDs were made unique: they follow their questions, and those that
     * aren't a question of the board are left out
     */
    private static checkDailyDoubles(round: IJeopardyRound, renamed: Map<string, string>): IJeopardyRound {
        if (round.dailyDoubleQuestionIds == null) {
            return round;
        }
        const ids = new Set(RoundRulesHelper.get(round).getQuestions(round).map(question => question.id));
        const dailyDoubleQuestionIds = [...new Set(round.dailyDoubleQuestionIds.map(questionId => renamed.get(questionId) ?? questionId))]
            .filter(questionId => ids.has(questionId));
        return {...round, dailyDoubleQuestionIds};
    }

    private static isSupportedRound(round: unknown): boolean {
        return RoundRulesHelper.isSupportedRound(round);
    }

    public static makeClassicRound(id: string, name: string, questions: IQuestion[]): IClassicRound {
        return {id, mode: 'classic', name, questions};
    }

    public static makeJeopardyRound(id: string, name: string, values: number[], categories: IJeopardyCategory[],
                                    dailyDoubleQuestionIds: string[] = []): IJeopardyRound {
        const round: IJeopardyRound = {id, mode: 'jeopardy', name, values, categories};
        // left out without any, like in versions from before they existed
        if (dailyDoubleQuestionIds.length > 0) {
            round.dailyDoubleQuestionIds = dailyDoubleQuestionIds;
        }
        return round;
    }

    public static makeFinalRound(id: string, name: string, category: string, question: IQuestion): IFinalRound {
        return {id, mode: 'final', name, category, question};
    }

    /**
     * A state as it is read from a file or a bundle, in the current format, for the version it plays
     */
    public static migrateState(state: IGameInstanceState, definition: IGameDefinition): IGameInstanceState {
        return {
            ...state,
            formatVersion: CURRENT_GAME_FORMAT_VERSION,
            gameState: state.gameState == null ? state.gameState : this.migrateGameState(state.gameState, definition.rounds)
        };
    }

    /**
     * The game state in the current format, with a progress for every round. States from before rounds were on a
     * question of the one round by its number. What doesn't fit the rounds (e.g. a round that isn't there) starts over.
     */
    public static migrateGameState(gameState: IGameState, rounds: IRound[]): IGameState {
        const {currentQuestionNumber, ...rest} = gameState as IGameState & ILegacyGameState;
        const migrated: IGameState = {...rest, roundProgress: {...(rest.roundProgress ?? {})}};
        if (gameState.roundProgress == null && rounds[0] != null && currentQuestionNumber != null) {
            const firstRound = rounds[0];
            const rules = RoundRulesHelper.get(firstRound);
            const start = rules.completeProgress(firstRound, undefined);
            migrated.currentRoundId = firstRound.id;
            migrated.roundProgress[firstRound.id] = rules.selectQuestion(firstRound, start, currentQuestionNumber) ?? start;
        }
        return this.completeGameState(migrated, rounds);
    }

    /**
     * Makes sure the current round is one of the rounds, and every round has its progress
     */
    public static completeGameState(gameState: IGameState, rounds: IRound[]): IGameState {
        const roundProgress: Record<string, IRoundProgress> = {};
        for (const round of rounds) {
            roundProgress[round.id] = RoundRulesHelper.get(round).completeProgress(round, gameState.roundProgress?.[round.id]);
        }
        const isRound = rounds.some(round => round.id === gameState.currentRoundId);
        return {...gameState, currentRoundId: isRound ? gameState.currentRoundId : (rounds[0]?.id ?? ''), roundProgress};
    }

    public static getRound(rounds: IRound[] | null | undefined, roundId: string | null | undefined): IRound | undefined {
        return (rounds ?? []).find(round => round.id === roundId);
    }

    public static getRoundIndex(rounds: IRound[] | null | undefined, roundId: string | null | undefined): number {
        return (rounds ?? []).findIndex(round => round.id === roundId);
    }

    public static getCurrentRound(rounds: IRound[] | null | undefined, gameState: IGameState | null | undefined): IRound | undefined {
        return this.getRound(rounds, gameState?.currentRoundId);
    }

    public static getCurrentProgress(gameState: IGameState | null | undefined): IRoundProgress | undefined {
        return gameState?.roundProgress?.[gameState.currentRoundId];
    }

    public static getCurrentQuestion(rounds: IRound[] | null | undefined, gameState: IGameState | null | undefined): IQuestion | undefined {
        const round = this.getCurrentRound(rounds, gameState);
        return round ? RoundRulesHelper.get(round).getCurrentQuestion(round, this.getCurrentProgress(gameState)) : undefined;
    }

    /**
     * Every question of every round
     */
    public static getAllQuestions(rounds: IRound[] | null | undefined): IQuestion[] {
        return (rounds ?? []).flatMap(round => RoundRulesHelper.get(round).getQuestions(round));
    }

    /**
     * The rounds with every question changed, e.g. with their media defaults
     */
    public static mapQuestions(rounds: IRound[], map: (question: IQuestion) => IQuestion): IRound[] {
        return rounds.map(round => RoundRulesHelper.get(round).mapQuestions(round, map));
    }

    /**
     * Where the game is; a state without progress yet is at the start
     */
    public static getProgress(rounds: IRound[], gameState: IGameState | null | undefined): IGameProgress {
        const roundIndex = Math.max(0, this.getRoundIndex(rounds, gameState?.currentRoundId));
        const round = rounds[roundIndex];
        if (round == null) {
            return {roundNumber: 1, roundCount: rounds.length, mode: 'classic', questionNumber: 1, questionCount: 0};
        }
        const rules = RoundRulesHelper.get(round);
        const progress = rules.completeProgress(round, gameState?.roundProgress?.[round.id]);
        return {
            roundNumber: roundIndex + 1,
            roundCount: rounds.length,
            mode: round.mode,
            // a board is played in any order, so how far it got is how many tiles are played
            questionNumber: round.mode === 'jeopardy'
                ? (progress as IJeopardyRoundProgress).playedQuestionIds.length
                : rules.getCurrentQuestionIndex(round, progress) + 1,
            questionCount: rules.getQuestions(round).length
        };
    }

    /**
     * E.g. "Runde 2 von 3, Frage 4 von 10", or just "Frage 4 von 10" for a game of one round; "4 von 25 Kacheln
     * gespielt" on a Jeopardy board, "Finale" in the final
     */
    public static describeProgress(progress: IGameProgress): string {
        let where: string;
        if (progress.mode === 'jeopardy') {
            where = `${progress.questionNumber} von ${progress.questionCount} Kacheln gespielt`;
        } else if (progress.mode === 'final') {
            where = 'Finale';
        } else {
            where = `Frage ${Math.min(progress.questionNumber, progress.questionCount)} von ${progress.questionCount}`;
        }
        return progress.roundCount > 1 ? `Runde ${progress.roundNumber} von ${progress.roundCount}, ${where}` : where;
    }
}
