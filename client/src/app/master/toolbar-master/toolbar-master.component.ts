import { Component, OnInit } from '@angular/core';
import config from '../../../../../config.json';
import {GameService} from '../../services/game.service';

@Component({
  selector: 'app-toolbar-master',
  templateUrl: './toolbar-master.component.html',
  styleUrls: ['./toolbar-master.component.css']
})
export class ToolbarMasterComponent implements OnInit {

  constructor(private game: GameService) { }

  ngOnInit(): void {
  }

  public getName(): string {
    return this.game.getGameName();
  }

}
