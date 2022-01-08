import {Component, OnInit} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {EVideoStates} from '../../../../../../shared/shared';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-media-remote',
  templateUrl: './media-remote.component.html',
  styleUrls: ['./media-remote.component.css']
})
export class MediaRemoteComponent implements OnInit {
  public state: EVideoStates = EVideoStates.VIDEO_LOADED;
  EVideoStates: EVideoStates;
  private mediaUpdateSubscription: Subscription;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        this.state = packet.newState;
        if (packet.newState === EVideoStates.RESET) {
          this.state = EVideoStates.PLAYING;
        }
      }
    );
  }

  play(): void {
    this.game.updateMediaState(EVideoStates.PLAYING);
  }

  pause(): void {
    this.game.updateMediaState(EVideoStates.STOPPED);
  }

  replay(): void {
    this.game.updateMediaState(EVideoStates.RESET);
  }

  skip(): void {
    this.game.updateMediaState(EVideoStates.FINISHED);
  }

  isPlaying(): boolean {
    return this.state === EVideoStates.PLAYING;
  }

  isNotFinished(): boolean {
    return this.state !== EVideoStates.FINISHED;
  }
}
