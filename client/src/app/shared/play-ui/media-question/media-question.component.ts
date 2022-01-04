import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {VgApiService} from '@videogular/ngx-videogular/core';
import {EVideoStates, IMediaDetails} from '../../../../../../shared/shared';
import {Subscription} from 'rxjs';
import {SubscriptionsHelper} from '../../../helper/subscriptions.helper';
import {GameService} from '../../../services/game.service';

@Component({
  selector: 'app-media-question',
  templateUrl: './media-question.component.html',
  styleUrls: ['./media-question.component.css']
})
export class MediaQuestionComponent implements OnInit, OnDestroy {
  @Input() media: IMediaDetails;

  api: VgApiService;
  videoSrc;

  private mediaUpdateSubscription: Subscription;


  constructor(private game: GameService) {
  }

  ngOnInit(): void {
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        console.log('Media Change', packet);
        switch (packet.newState) {
          case EVideoStates.STOPPED:
            this.pausePlayback();
            break;
          case EVideoStates.PLAYING:
            this.startPlayback();
            break;
          case EVideoStates.RESET:
            this.restartPlayback();
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
        this.disableFullscreen();
      }
    );
  }

  startPlayback(): void {
    if (this.api) {
      this.api.getDefaultMedia().play();
      this.enableFullscreen();
    }
  }

  pausePlayback(): void {
    this.api.getDefaultMedia().pause();
  }

  restartPlayback(): void {
    this.api.getDefaultMedia().currentTime = 0;
    this.api.getDefaultMedia().play();
  }

  enableFullscreen(): void {
    if (!this.api.fsAPI.isFullscreen) {
      this.api.fsAPI.toggleFullscreen();
    }
  }

  disableFullscreen(): void {
    if (this.api.fsAPI.isFullscreen) {
      this.api.fsAPI.toggleFullscreen();
    }
  }
}
