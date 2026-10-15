import {Component, Input, OnInit} from '@angular/core';
import {GameService} from '../../services/game.service';

@Component({
    selector: 'app-toolbar-master',
    templateUrl: './toolbar-master.component.html',
    styleUrls: ['./toolbar-master.component.css'],
    standalone: false
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

  public exportGameState(): void {
    this.game.downloadGameStateAsJson(this.getDownloadFileName());
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
