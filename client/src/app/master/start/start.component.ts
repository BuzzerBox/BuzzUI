import { Component, OnInit } from '@angular/core';
import {ClientGameMasterAndScreenService} from '../../services/game-client/client-game-master-and-screen.service';
import {Title} from '@angular/platform-browser';
import {ConfigService} from '../../services/config.service';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.css']
})
export class StartComponent implements OnInit {

  constructor(private gs: ClientGameMasterAndScreenService, private titleService: Title) {
    titleService.setTitle(ConfigService.get().gameName + ' ' + ConfigService.get().masterName);
    gs.useAsMaster();
  }

  ngOnInit(): void {
  }

}
