import {Component, OnInit} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {EVideoStates} from '../../../../../../shared/shared';

@Component({
  selector: 'app-media-remote',
  templateUrl: './media-remote.component.html',
  styleUrls: ['./media-remote.component.css']
})
export class MediaRemoteComponent implements OnInit {

  constructor(private game: GameService) { }

  ngOnInit(): void {
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

}
