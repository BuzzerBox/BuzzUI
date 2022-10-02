import { Component, OnInit } from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'app-virtual-dev-board',
  templateUrl: './virtual-dev-board.component.html',
  styleUrls: ['./virtual-dev-board.component.css']
})
export class VirtualDevBoardComponent implements OnInit {
  public isConnected$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor() { }

  ngOnInit(): void {
    // simulating a deferred connection
    setTimeout(() => {
      this.isConnected$.next(true);
    }, 1000);
  }

}
