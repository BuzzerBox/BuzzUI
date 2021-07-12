import {Component, Input, OnInit} from '@angular/core';
import config from '../../../../../config.json';
import {GameService} from '../../services/game.service';
import {SafeUrl} from '@angular/platform-browser';

@Component({
  selector: 'app-toolbar-master',
  templateUrl: './toolbar-master.component.html',
  styleUrls: ['./toolbar-master.component.css']
})
export class ToolbarMasterComponent implements OnInit {
  @Input() showSaveIcon = false;
  @Input() showReleaseBuzzerLockIcon = false;

  constructor(private game: GameService) { }

  ngOnInit(): void {
  }

  public getName(): string {
    return this.game.getGameName();
  }

  public exportGameState(): SafeUrl {
    return this.game.exportGameStateAsJson();
  }

  public getDownloadFileName(): string {
    return this.getName().toLowerCase().replace(' ', '-') + '-save-file.json';
  }

  public resetServer(): void {
    this.game.resetServer();
    setTimeout(window.location.reload, 250);
    // ();
  }

  public releaseBuzzerLock(): void {
    this.game.releaseBuzzerLock();
  }

}
