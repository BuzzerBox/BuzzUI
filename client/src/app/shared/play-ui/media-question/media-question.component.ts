import {Component, HostListener, Input, OnDestroy, OnInit} from '@angular/core';
import {VgApiService} from '@videogular/ngx-videogular/core';
import {EMediaStates, EQuestionAnswerStates, IMediaDetails, FileExtensionsService} from '../../../../../../shared/shared';
import {Subscription} from 'rxjs';
import {SubscriptionsHelper} from '../../../helper/subscriptions.helper';
import {GameService} from '../../../services/game.service';

@Component({
    selector: 'app-media-question',
    templateUrl: './media-question.component.html',
    styleUrls: ['./media-question.component.css'],
    standalone: false
})
export class MediaQuestionComponent implements OnInit, OnDestroy {
  @Input() media: IMediaDetails;
  api: VgApiService;

  private mediaUpdateSubscription: Subscription;
  public mediaVisible = false;
  public fullscreen = false;
  // set when the browser refused to play with sound because nobody has interacted with the page yet
  public soundBlocked = false;


  constructor(private game: GameService) {
  }

  ngOnInit(): void {
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        this.fullscreen = !!packet.mediaQuestionState.fullscreen;
        switch (packet.mediaQuestionState.mediaState) {
          // this component is reused when the next question also has media, so hide whatever was shown before
          case EMediaStates.NO_MEDIA:
          case EMediaStates.HIDDEN:
          case EMediaStates.PAUSED:
            this.pausePlayback();
            break;
          case EMediaStates.PLAYING:
            this.startPlayback();
            break;
          case EMediaStates.RESET:
            this.restartPlayback();
            break;
          case EMediaStates.FINISHED:
            this.pausePlayback();
            if (this.api && this.api.getDefaultMedia()) {
              this.api.getDefaultMedia().currentTime = 0;
            }
            break;
        }
      }
    );

  }

  ngOnDestroy(): void {
    SubscriptionsHelper.cleanUpSubscriptions(this.mediaUpdateSubscription);
  }

  onPlayerReady(api: VgApiService): void {
    this.api = api;
    this.api.getDefaultMedia().subscriptions.ended.subscribe(
      () => {
        const current = this.game.getCurrentMediaQuestionState();
        const questionState = current.questionState === EQuestionAnswerStates.WAIT_FOR_MEDIA
          ? EQuestionAnswerStates.SHOWN
          : current.questionState;
        const answerState = current.answerState === EQuestionAnswerStates.WAIT_FOR_MEDIA
          ? EQuestionAnswerStates.SHOWN
          : current.answerState;
        this.game.updateMediaState(EMediaStates.FINISHED, questionState, answerState);
      }
    );
    if (this.mediaVisible) {
      this.playMedia();
    }
  }

  /**
   * Browsers only allow playback with sound once the user interacted with the page (e.g. a laptop screen that was
   * reloaded). In that case, play muted instead and unmute on the next click or keypress, see enableSound().
   */
  private playMedia(): void {
    const media = this.api?.getDefaultMedia();
    if (!media) {
      return;
    }
    media.play()?.catch((error: DOMException) => {
      if (error?.name !== 'NotAllowedError' || media.elem.muted) {
        return;
      }
      this.soundBlocked = true;
      media.elem.muted = true;
      // videogular still considers its own play() call pending at this point and would ignore another one
      media.elem.play().catch(() => {});
    });
  }

  @HostListener('document:click')
  @HostListener('document:keydown')
  enableSound(): void {
    if (!this.soundBlocked) {
      return;
    }
    this.soundBlocked = false;
    const media = this.api?.getDefaultMedia();
    if (media) {
      media.elem.muted = false;
    }
  }

  startPlayback(): void {
    this.playMedia();
    this.mediaVisible = true;
  }

  pausePlayback(): void {
    if (this.api && this.api.getDefaultMedia()) {
      this.api.getDefaultMedia().pause();
    }
    this.mediaVisible = false;
  }

  restartPlayback(): void {
    if (this.api && this.api.getDefaultMedia()) {
      this.api.getDefaultMedia().currentTime = 0;
      this.playMedia();
    }
    this.mediaVisible = true;

  }

  public getExtension(path: string): string {
    return '.' + path.split('.').pop();
  }

  public isVideo(): boolean {
    return FileExtensionsService.isVideo(this.media.fileSrc);
  }

  public isImage(): boolean {
    return FileExtensionsService.isImage(this.media.fileSrc);
  }
}
