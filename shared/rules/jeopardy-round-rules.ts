import {IQuestion} from '../interfaces/IQuestion';
import {IJeopardyCategory, IJeopardyRound, IJeopardyRoundProgress, IPlayOptions} from '../interfaces/IRound';
import {ISelectQuestionPacket} from '../interfaces/ISelectQuestionPacket';
import {EGradeResults} from '../enums/EGradeResults';
import {IRoundRules} from './round-rules';
import {WagerHelper} from './wager.helper';

/**
 * Where a question is on the board
 */
export interface IJeopardyTile {
    category: IJeopardyCategory;
    categoryIndex: number;
    valueIndex: number;
    value: number;
    question: IQuestion;
}

/**
 * A board of categories × values. The team that picks says a tile, the master opens it, and every team may buzz. A
 * correct answer is worth the tile's value, a double one twice it; it closes the tile, and the team picks next. A wrong
 * answer costs the value and lets the other teams buzz, but with IPlayOptions.oneTryPerTile not that team. If no team
 * knows it, the master closes the tile without points.
 * A Daily Double is answered by the team that picked it, nobody buzzes: it wagers up to its points, or up to the
 * board's highest value if that is more, and wins or loses the wager. It closes the tile either way.
 */
export class JeopardyRoundRules implements IRoundRules<IJeopardyRound, IJeopardyRoundProgress> {
    public isWellFormed(round: unknown): boolean {
        const candidate = round as Partial<IJeopardyRound>;
        return Array.isArray(candidate?.values) && candidate.values.every(value => typeof value === 'number' && Number.isFinite(value))
            && Array.isArray(candidate.categories)
            && candidate.categories.every(category => Array.isArray(category?.questions) && category.questions.length === candidate.values.length)
            && (candidate.dailyDoubleQuestionIds == null
                || (Array.isArray(candidate.dailyDoubleQuestionIds) && candidate.dailyDoubleQuestionIds.every(id => typeof id === 'string')));
    }

    public completeProgress(round: IJeopardyRound, progress: Partial<IJeopardyRoundProgress> | undefined): IJeopardyRoundProgress {
        const ids = new Set(this.getQuestions(round).map(question => question.id));
        const played = Array.isArray(progress?.playedQuestionIds) ? progress.playedQuestionIds.filter(id => ids.has(id)) : [];
        const openQuestionId = ids.has(progress?.openQuestionId) ? progress.openQuestionId : null;
        // states from before attemptQuestionId kept the wagers and lockouts of the open tile only
        const attempt = progress?.attemptQuestionId !== undefined ? progress.attemptQuestionId : openQuestionId;
        const attemptQuestionId = ids.has(attempt) && !played.includes(attempt) ? attempt : null;
        return {
            playedQuestionIds: [...new Set(played)],
            openQuestionId,
            pickingTeamId: typeof progress?.pickingTeamId === 'string' ? progress.pickingTeamId : null,
            attemptQuestionId,
            wagers: attemptQuestionId == null ? {} : WagerHelper.completeWagers(progress?.wagers),
            lockedOutTeamIds: attemptQuestionId != null && Array.isArray(progress?.lockedOutTeamIds)
                ? progress.lockedOutTeamIds.filter(id => typeof id === 'string') : []
        };
    }

    public getQuestions(round: IJeopardyRound): IQuestion[] {
        return round.categories.flatMap(category => category.questions);
    }

    public mapQuestions(round: IJeopardyRound, map: (question: IQuestion) => IQuestion): IJeopardyRound {
        return {...round, categories: round.categories.map(category => ({...category, questions: category.questions.map(map)}))};
    }

    public getCurrentQuestion(round: IJeopardyRound, progress: IJeopardyRoundProgress): IQuestion | undefined {
        return this.getTile(round, progress?.openQuestionId)?.question;
    }

    public getCurrentQuestionIndex(round: IJeopardyRound, progress: IJeopardyRoundProgress): number {
        return Math.max(0, this.getQuestions(round).findIndex(question => question.id === progress?.openQuestionId));
    }

    /**
     * The tiles are opened on the board, not one after the other
     */
    public selectQuestion(round: IJeopardyRound, progress: IJeopardyRoundProgress, index: number): IJeopardyRoundProgress | null {
        return null;
    }

    public hasPreviousQuestion(round: IJeopardyRound, progress: IJeopardyRoundProgress): boolean {
        return false;
    }

    public hasNextQuestion(round: IJeopardyRound, progress: IJeopardyRoundProgress): boolean {
        return false;
    }

    public isOver(round: IJeopardyRound, progress: IJeopardyRoundProgress): boolean {
        return progress?.openQuestionId == null && this.getQuestions(round).every(question => this.isPlayed(progress, question.id));
    }

    /**
     * Only while a tile is open that nobody answered correctly yet, and that isn't a Daily Double; with one try per
     * tile, not after the team answered it wrong
     */
    public mayBuzz(round: IJeopardyRound, progress: IJeopardyRoundProgress, teamId: string, options: IPlayOptions): boolean {
        return this.isOpenAndUnplayed(progress) && !this.isDailyDouble(round, progress.openQuestionId)
            && !(options?.oneTryPerTile !== false && this.isLockedOut(progress, teamId));
    }

    /**
     * Whether the team answered the open tile wrong
     */
    public isLockedOut(progress: IJeopardyRoundProgress | undefined, teamId: string): boolean {
        return progress?.openQuestionId != null && progress.attemptQuestionId === progress.openQuestionId
            && (progress.lockedOutTeamIds ?? []).includes(teamId);
    }

    /**
     * Any team on an open tile, except with one try per tile a team that answered it wrong already; on a Daily Double
     * only the team that picked it, once it wagered
     */
    public mayGrade(round: IJeopardyRound, progress: IJeopardyRoundProgress, teamId: string, options: IPlayOptions): boolean {
        if (!this.isOpenAndUnplayed(progress)) {
            return false;
        }
        if (this.isDailyDouble(round, progress.openQuestionId)) {
            return teamId === progress.pickingTeamId && progress.wagers?.[teamId] != null;
        }
        return !(options?.oneTryPerTile !== false && this.isLockedOut(progress, teamId));
    }

    public getGradePoints(round: IJeopardyRound, progress: IJeopardyRoundProgress, result: EGradeResults, teamId: string): number {
        if (this.isDailyDouble(round, progress?.openQuestionId)) {
            return WagerHelper.getPoints(progress.wagers?.[teamId], result !== EGradeResults.WRONG);
        }
        const factor = result === EGradeResults.DOUBLE ? 2 : result === EGradeResults.CORRECT ? 1 : -1;
        return factor * (this.getTile(round, progress?.openQuestionId)?.value ?? 0);
    }

    /**
     * A correct answer closes the tile (it stays shown until the master goes back to the board), and the team picks next.
     * A Daily Double closes either way, and the team that picked it picks again.
     */
    public afterGrade(round: IJeopardyRound, progress: IJeopardyRoundProgress, teamId: string, result: EGradeResults): IJeopardyRoundProgress {
        const openId = progress.openQuestionId;
        if (openId == null) {
            return progress;
        }
        if (this.isDailyDouble(round, openId)) {
            return {...progress, playedQuestionIds: this.addPlayed(progress, openId)};
        }
        if (result === EGradeResults.WRONG) {
            return this.isLockedOut(progress, teamId) ? progress : {...progress, lockedOutTeamIds: [...(progress.lockedOutTeamIds ?? []), teamId]};
        }
        return {...progress, playedQuestionIds: this.addPlayed(progress, openId), pickingTeamId: teamId};
    }

    public isDailyDouble(round: IJeopardyRound, questionId: string | null | undefined): boolean {
        return questionId != null && (round.dailyDoubleQuestionIds ?? []).includes(questionId);
    }

    /**
     * Up to the team's points, or up to the board's highest value if that is more
     */
    public getMaxWager(round: IJeopardyRound, teamPoints: number): number {
        return Math.max(teamPoints ?? 0, ...round.values, 0);
    }

    /**
     * The wager of the team that picked the open Daily Double, kept within getMaxWager; null if there is none to wager on
     */
    public applySetWager(round: IJeopardyRound, progress: IJeopardyRoundProgress, teamId: string, wager: unknown,
                         teamPoints: number): IJeopardyRoundProgress | null {
        const value = WagerHelper.clamp(wager, this.getMaxWager(round, teamPoints));
        if (!this.isOpenAndUnplayed(progress) || !this.isDailyDouble(round, progress.openQuestionId)
            || teamId !== progress.pickingTeamId || value == null) {
            return null;
        }
        return {...progress, wagers: {...progress.wagers, [teamId]: value}};
    }

    /**
     * Opens a tile, or closes the open one; null if the packet doesn't fit the board, e.g. opens a played tile. Going
     * back to the board without closing the tile for good keeps its wager and lockouts for when it is opened again.
     */
    public applySelectQuestion(round: IJeopardyRound, progress: IJeopardyRoundProgress, packet: ISelectQuestionPacket): IJeopardyRoundProgress | null {
        if (packet.questionId == null) {
            const openId = progress.openQuestionId;
            const playedQuestionIds = packet.markPlayed && openId != null ? this.addPlayed(progress, openId) : progress.playedQuestionIds;
            const closed = {...progress, playedQuestionIds, openQuestionId: null};
            return progress.attemptQuestionId != null && playedQuestionIds.includes(progress.attemptQuestionId)
                ? {...closed, attemptQuestionId: null, wagers: {}, lockedOutTeamIds: []}
                : closed;
        }
        if (this.getTile(round, packet.questionId) == null || this.isPlayed(progress, packet.questionId)) {
            return null;
        }
        if (packet.questionId === progress.attemptQuestionId) {
            return {...progress, openQuestionId: packet.questionId};
        }
        return {...progress, openQuestionId: packet.questionId, attemptQuestionId: packet.questionId, wagers: {}, lockedOutTeamIds: []};
    }

    public applySetPickingTeam(progress: IJeopardyRoundProgress, teamId: string | null): IJeopardyRoundProgress {
        return {...progress, pickingTeamId: typeof teamId === 'string' ? teamId : null};
    }

    public isPlayed(progress: IJeopardyRoundProgress | undefined, questionId: string): boolean {
        return (progress?.playedQuestionIds ?? []).includes(questionId);
    }

    public getTile(round: IJeopardyRound, questionId: string | null | undefined): IJeopardyTile | undefined {
        if (questionId == null) {
            return undefined;
        }
        for (let categoryIndex = 0; categoryIndex < round.categories.length; categoryIndex++) {
            const category = round.categories[categoryIndex];
            const valueIndex = category.questions.findIndex(question => question.id === questionId);
            if (valueIndex >= 0) {
                return {category, categoryIndex, valueIndex, value: round.values[valueIndex], question: category.questions[valueIndex]};
            }
        }
        return undefined;
    }

    private isOpenAndUnplayed(progress: IJeopardyRoundProgress | undefined): boolean {
        return progress?.openQuestionId != null && !this.isPlayed(progress, progress.openQuestionId);
    }

    private addPlayed(progress: IJeopardyRoundProgress, questionId: string): string[] {
        return this.isPlayed(progress, questionId) ? progress.playedQuestionIds : [...progress.playedQuestionIds, questionId];
    }
}
