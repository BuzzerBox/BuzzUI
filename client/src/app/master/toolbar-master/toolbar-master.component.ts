import { Component, OnInit } from '@angular/core';
import config from '../../../../../config.json';

@Component({
  selector: 'app-toolbar-master',
  templateUrl: './toolbar-master.component.html',
  styleUrls: ['./toolbar-master.component.css']
})
export class ToolbarMasterComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

  public getName(): string {
    return config.gameName + ' ' + config.masterName;
  }

}
