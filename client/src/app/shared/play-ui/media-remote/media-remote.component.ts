import {Component, Input, OnInit} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {
  EMediaStates,
  EQuestionAnswerStates,
  FileExtensionsService,
  IMediaDetails,
  IMediaQuestionState
} from '../../../../../../shared/shared';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-media-remote',
    templateUrl: './media-remote.component.html',
    styleUrls: ['./media-remote.component.css'],
    standalone: false
})
export class MediaRemoteComponent implements OnInit {
  @Input() media: IMediaDetails;
  public state: IMediaQuestionState = {
    mediaState: EMediaStates.NO_MEDIA,
    questionState: EQuestionAnswerStates.SHOWN,
    answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA
  };
  EVideoStates: EMediaStates;
  private mediaUpdateSubscription: Subscription;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        this.state = packet.mediaQuestionState;
        if (packet.mediaQuestionState.mediaState === EMediaStates.RESET) {
          this.state.mediaState = EMediaStates.PLAYING;
        }
      }
    );
  }

  play(): void {
    this.game.updateMediaState(EMediaStates.PLAYING);
  }

  pause(): void {
    this.game.updateMediaState(EMediaStates.PAUSED);
  }

  replay(): void {
    this.game.updateMediaState(EMediaStates.RESET);
  }

  skip(): void {
    this.game.updateMediaState(EMediaStates.FINISHED);
  }

  isPlaying(): boolean {
    return this.state.mediaState === EMediaStates.PLAYING;
  }

  isNotFinished(): boolean {
    return this.state.mediaState !== EMediaStates.FINISHED;
  }

  public isVideo(): boolean {
    return FileExtensionsService.isVideo(this.media.fileSrc);
  }

  public isImage(): boolean {
    return FileExtensionsService.isImage(this.media.fileSrc);
  }


}
