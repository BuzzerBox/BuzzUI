import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {
  EMediaStates,
  EQuestionAnswerStates,
  FileExtensionsService,
  IMediaDetails,
  IMediaQuestionState, IQuestion, PacketHelper
} from '../../../../../../shared/shared';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-media-remote',
    templateUrl: './media-remote.component.html',
    styleUrls: ['./media-remote.component.css'],
    standalone: false
})
export class MediaRemoteComponent implements OnInit, OnDestroy {
  @Input() question: IQuestion;
  public state: IMediaQuestionState;
  private mediaUpdateSubscription: Subscription;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.state = PacketHelper.getDefaultMediaState();
    if (this.question.initialConfig) {
      this.state = this.question.initialConfig;
    }
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        this.state = packet.mediaQuestionState;
        if (packet.mediaQuestionState.mediaState === EMediaStates.RESET) {
          this.state.mediaState = EMediaStates.PLAYING;
        }
      }
    );
  }

  ngOnDestroy(): void {
    this.mediaUpdateSubscription.unsubscribe();
  }

  play(): void {
    this.game.updateMediaState(EMediaStates.PLAYING, this.state.questionState, this.state.answerState, this.state.fullscreen);
  }

  pause(): void {
    this.game.updateMediaState(EMediaStates.PAUSED, this.state.questionState, this.state.answerState, this.state.fullscreen);
  }

  replay(): void {
    this.game.updateMediaState(EMediaStates.RESET, this.state.questionState, this.state.answerState, this.state.fullscreen);
  }

  showAnswers(): void {
    this.state.answerState = EQuestionAnswerStates.SHOWN;
    this.game.updateMediaState(this.state.mediaState, this.state.questionState, this.state.answerState, this.state.fullscreen);
  }

  hideAnswers(): void {
    this.state.answerState = EQuestionAnswerStates.HIDDEN;
    this.game.updateMediaState(this.state.mediaState, this.state.questionState, this.state.answerState, this.state.fullscreen);
  }

  isPlaying(): boolean {
    return this.state.mediaState === EMediaStates.PLAYING;
  }

  isNotFinished(): boolean {
    return this.state.mediaState !== EMediaStates.FINISHED;
  }

  showQuestion(): void {
    this.state.questionState = EQuestionAnswerStates.SHOWN;
    this.game.updateMediaState(this.state.mediaState, this.state.questionState, this.state.answerState, this.state.fullscreen);
  }

  hideQuestion(): void {
    this.state.questionState = EQuestionAnswerStates.HIDDEN;
    this.game.updateMediaState(this.state.mediaState, this.state.questionState, this.state.answerState, this.state.fullscreen);
  }

  toggleFullscreen(): void {
    this.state.fullscreen = !this.state.fullscreen;
    this.game.updateMediaState(this.state.mediaState, this.state.questionState, this.state.answerState, this.state.fullscreen);
  }

  isFullscreen(): boolean {
    return !!this.state.fullscreen;
  }

  isQuestionHidden(): boolean {
    return this.state.questionState === EQuestionAnswerStates.HIDDEN
      || this.state.questionState === EQuestionAnswerStates.WAIT_FOR_MEDIA;
  }

  isAnswersShown(): boolean {
    return this.state.answerState === EQuestionAnswerStates.SHOWN;
  }

  public isVideo(): boolean {
    return FileExtensionsService.isVideo(this.question.mediaDetails.fileSrc);
  }

  public isImage(): boolean {
    return FileExtensionsService.isImage(this.question.mediaDetails.fileSrc);
  }


}
