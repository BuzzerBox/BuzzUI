import {Component, Input, OnDestroy, OnInit} from '@angular/core';
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


  constructor(private game: GameService) {
  }

  ngOnInit(): void {
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        this.fullscreen = !!packet.mediaQuestionState.fullscreen;
        switch (packet.mediaQuestionState.mediaState) {
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
      this.api.getDefaultMedia().play();
    }
  }

  startPlayback(): void {
    if (this.api && this.api.getDefaultMedia()) {
      this.api.getDefaultMedia().play();
    }
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
      this.api.getDefaultMedia().play();
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
