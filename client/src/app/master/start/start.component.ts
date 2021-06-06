import { Component, OnInit } from '@angular/core';
import {GameService} from '../../services/game.service';
import config from '../../../../../config.json';
import {Title} from '@angular/platform-browser';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.css']
})
export class StartComponent implements OnInit {

  constructor(private gs: GameService, private titleService: Title) {
    titleService.setTitle(config.gameName + ' ' + config.masterName);
    gs.useAsMaster();
  }

  ngOnInit(): void {
  }

}
