import {Component, Input, OnInit} from '@angular/core';
import {GameService} from '../../services/game.service';
import {MatDialog} from '@angular/material/dialog';
import {DialogTeamsComponent} from '../dialog-teams/dialog-teams.component';

@Component({
    selector: 'app-toolbar-master',
    templateUrl: './toolbar-master.component.html',
    styleUrls: ['./toolbar-master.component.css'],
    standalone: false
})
export class ToolbarMasterComponent implements OnInit {
  @Input() showSaveIcon = false;
  @Input() showReleaseBuzzerLockIcon = false;
  // only once the game is set up, since the setup has its own teams step
  @Input() showTeamsIcon = false;

  constructor(private game: GameService, private dialog: MatDialog) { }

  public openTeamsDialog(): void {
    this.dialog.open(DialogTeamsComponent);
  }

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
