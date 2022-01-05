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
    // TODO this should not directly depend on the Update, but on the MediaState of the Game. The local state should not exist.
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        switch (packet.newState) {
          case EVideoStates.STOPPED:
            this.state = EVideoStates.STOPPED;
            break;
          case EVideoStates.PLAYING:
            this.state = EVideoStates.PLAYING;
            break;
          case EVideoStates.RESET:
            this.state = EVideoStates.RESET;
        }
      }
    );
  }

  play(): void {
    this.game.updateMediaState(EVideoStates.PLAYING);
    this.state = EVideoStates.PLAYING;
  }

  pause(): void {
    this.game.updateMediaState(EVideoStates.STOPPED);
    this.state = EVideoStates.STOPPED;
  }

  replay(): void {
    this.game.updateMediaState(EVideoStates.RESET);
    this.state = EVideoStates.PLAYING;
  }

  isPlaying(): boolean {
    return this.state === EVideoStates.PLAYING;
  }
}
