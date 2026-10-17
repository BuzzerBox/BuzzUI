import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.css'],
  standalone: false
})
export class LoadingSpinnerComponent {
  @Input() text = '';
  // as large as before on big screens, but no more than half of a small one
  public readonly spinnerDiameter = Math.round(Math.min(400, window.innerHeight * 0.5, window.innerWidth * 0.5));
}
