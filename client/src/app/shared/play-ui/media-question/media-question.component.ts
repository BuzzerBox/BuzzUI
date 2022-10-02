import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {VgApiService} from '@videogular/ngx-videogular/core';
import {EVideoStates, IMediaDetails, FileExtensionsService} from '../../../../../../shared/shared';
import {Subscription} from 'rxjs';
import {SubscriptionsHelper} from '../../../helper/subscriptions.helper';
import {ClientGameMasterAndScreenService} from '../../../services/game-client/client-game-master-and-screen.service';

@Component({
  selector: 'app-media-question',
  templateUrl: './media-question.component.html',
  styleUrls: ['./media-question.component.css']
})
export class MediaQuestionComponent implements OnInit, OnDestroy {
  @Input() media: IMediaDetails;
  api: VgApiService;

  private mediaUpdateSubscription: Subscription;
  public mediaVisible = false;


  constructor(private game: ClientGameMasterAndScreenService) {
  }

  ngOnInit(): void {
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        switch (packet.newState) {
          case EVideoStates.STOPPED:
            this.pausePlayback();
            break;
          case EVideoStates.PLAYING:
            this.startPlayback();
            break;
          case EVideoStates.RESET:
            this.restartPlayback();
            break;
          case EVideoStates.FINISHED:
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
        this.game.updateMediaState(EVideoStates.FINISHED);
      }
    );
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
