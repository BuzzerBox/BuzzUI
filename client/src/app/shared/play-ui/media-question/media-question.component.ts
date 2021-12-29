import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {VgApiService} from '@videogular/ngx-videogular/core';
import {IMediaDetails} from '../../../../../../shared/shared';

@Component({
  selector: 'app-media-question',
  templateUrl: './media-question.component.html',
  styleUrls: ['./media-question.component.css']
})
export class MediaQuestionComponent implements OnInit, OnDestroy {
  @Input() media: IMediaDetails;

  api: VgApiService;
  videoSrc;
  constructor() {
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
  }

  onPlayerReady(api: VgApiService): void {
    this.api = api;
    this.startPlayback();
    this.api.getDefaultMedia().subscriptions.ended.subscribe(
      () => {
        // Set the video to the beginning
        this.restartPlayback();
      }
    );
  }

  startPlayback(): void {
    if (this.api) {
      this.api.getDefaultMedia().play();
    }
  }

  pausePlayback(): void {
    this.api.getDefaultMedia().pause();
  }

  restartPlayback(): void {
    this.api.getDefaultMedia().currentTime = 0;
    this.api.getDefaultMedia().play();
  }
}
