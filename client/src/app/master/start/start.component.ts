import { Component, OnInit } from '@angular/core';
import {GameService} from '../../services/game.service';
import {Title} from '@angular/platform-browser';
import {ConfigService} from '../../services/config.service';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.css']
})
export class StartComponent implements OnInit {

  constructor(private gs: GameService, private titleService: Title, private config: ConfigService) {
    titleService.setTitle(config.get().gameName + ' ' + config.get().masterName);
    gs.useAsMaster();
  }

  ngOnInit(): void {
  }

}
