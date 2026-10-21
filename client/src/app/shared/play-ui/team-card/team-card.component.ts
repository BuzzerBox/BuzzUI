import {Component, DoCheck, HostBinding, Input, OnDestroy, OnInit} from '@angular/core';
import {ITeam, IMarkTeamPacket, IGradeAnswerPacket, EGradeResults} from '../../../../../../shared/shared';
import {GameService} from '../../../services/game.service';
import {SubscriptionsHelper} from '../../../helper/subscriptions.helper';
import {TeamColorHelper} from '../../../helper/team-color.helper';
import {ScreenThemeHelper} from '../../../themes/screen-theme.helper';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-team-card',
    templateUrl: './team-card.component.html',
    styleUrls: ['./team-card.component.css'],
    standalone: false
})
export class TeamCardComponent implements OnInit, DoCheck, OnDestroy {
  private static readonly COUNT_DURATION_IN_MS = 600;
  private static readonly COUNT_STEPS = 12;
  // how long the change of the points shows next to them, and the card flashes after a grade
  private static readonly EFFECT_DURATION_IN_MS = 1600;

  @Input() team: ITeam;
  @Input() isMaster = false;

  @HostBinding('class.screen') get isScreen(): boolean {
    return !this.isMaster;
  }

  // the effects of the quiz-show themes, see screen-themes.ts
  @HostBinding('class.show') get isShowStyle(): boolean {
    return this.isScreen && ScreenThemeHelper.isShowStyle(this.game.getGameStateData()?.themeId);
  }

  @HostBinding('style.--team-color') get teamColor(): string {
    return TeamColorHelper.getColor(this.team, this.game.getTeams() ?? []);
  }

  @HostBinding('style.--team-on-color') get teamTextColor(): string {
    return TeamColorHelper.getTextColor(this.teamColor);
  }

  private markTeamPacketsSubscription: Subscription;
  private gradeAnswerSubscription: Subscription;
  public isMarked = false;
  // the screens count up (or down) to new points and show the change above them for a moment
  public displayedPoints: number;
  // the points the count is heading for
  private targetPoints: number;
  public pointsChange: number | null = null;
  // changes with every change of the points, so the change pops up again
  public pointsChangeId = 0;
  public grade: 'correct' | 'wrong' | null = null;
  private countTimer: ReturnType<typeof setInterval> | null = null;
  private pointsChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  private gradeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    // after a reload or a master rejoining, show the team that buzzed
    this.isMarked = !!this.game.getGameStateData()?.markedTeamIds?.includes(this.team.teamId);
    this.displayedPoints = this.targetPoints = this.getPoints();
    this.markTeamPacketsSubscription = this.game.observeMarkTeamPackets().subscribe(this.onMarkTeamPacket.bind(this));
    if (this.isShowStyle) {
      this.gradeAnswerSubscription = this.game.observeGradeAnswerPackets().subscribe(this.onGradeAnswerPacket.bind(this));
    }
  }

  /**
   * The points change on the team object, from the master's buttons as well as from grading
   */
  ngDoCheck(): void {
    const points = this.getPoints();
    if (!this.isShowStyle) {
      this.displayedPoints = this.targetPoints = points;
    } else if (points !== this.targetPoints) {
      this.onPointsChanged(points - this.targetPoints, points);
    }
  }

  private onPointsChanged(change: number, points: number): void {
    const from = this.displayedPoints;
    this.targetPoints = points;
    this.pointsChange = change;
    this.pointsChangeId++;
    clearTimeout(this.pointsChangeTimeout);
    this.pointsChangeTimeout = setTimeout(() => this.pointsChange = null, TeamCardComponent.EFFECT_DURATION_IN_MS);
    clearInterval(this.countTimer);
    let step = 0;
    this.countTimer = setInterval(() => {
      step++;
      this.displayedPoints = step >= TeamCardComponent.COUNT_STEPS
        ? points
        : Math.round(from + (points - from) * step / TeamCardComponent.COUNT_STEPS);
      if (step >= TeamCardComponent.COUNT_STEPS) {
        clearInterval(this.countTimer);
        this.countTimer = null;
      }
    }, TeamCardComponent.COUNT_DURATION_IN_MS / TeamCardComponent.COUNT_STEPS);
  }

  public addPoint(): void {
    this.game.addPoint(this.team);
  }

  public removePoint(): void {
    this.game.removePoint(this.team);
  }

  /**
   * What the current question is worth
   */
  public getQuestionPoints(): number {
    return GameService.getQuestionPoints(this.game.getCurrentQuestion());
  }

  public addQuestionPoints(): void {
    this.game.addPoints(this.team, this.getQuestionPoints());
  }

  public getName(): string {
    return this.team.name;
  }

  public getPoints(): number {
    return this.team.points ?? 0;
  }

  /**
   * Another team buzzed, so this one steps back
   */
  public isDimmed(): boolean {
    return !this.isMarked && (this.game.getGameStateData()?.markedTeamIds?.length ?? 0) > 0;
  }

  /**
   * Has the most points, once the points differ at all
   */
  public isLeader(): boolean {
    const points = (this.game.getTeams() ?? []).map(team => team.points ?? 0);
    const most = Math.max(...points);
    return points.length > 1 && most > Math.min(...points) && this.getPoints() === most;
  }

  private onMarkTeamPacket(packet: IMarkTeamPacket): void {
    if (packet.unmarkAll) {
      this.isMarked = false;
    } else if (this.team.teamId === packet.teamId) {
      this.isMarked = packet.mark;
    }
  }

  private onGradeAnswerPacket(packet: IGradeAnswerPacket): void {
    if (packet.teamId !== this.team.teamId) {
      return;
    }
    this.grade = packet.result === EGradeResults.WRONG ? 'wrong' : 'correct';
    clearTimeout(this.gradeTimeout);
    this.gradeTimeout = setTimeout(() => this.grade = null, TeamCardComponent.EFFECT_DURATION_IN_MS);
  }

  ngOnDestroy(): void {
    SubscriptionsHelper.cleanUpSubscriptions(this.markTeamPacketsSubscription, this.gradeAnswerSubscription);
    clearInterval(this.countTimer);
    clearTimeout(this.pointsChangeTimeout);
    clearTimeout(this.gradeTimeout);
  }

  private markTeamInvert(): void {
    this.isMarked = !this.isMarked;
    this.game.setMarkTeam(this.team.teamId, this.isMarked);
  }

}
