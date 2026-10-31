import {Component, Input} from '@angular/core';
import {BuzzerHelper} from '../../../../../shared/shared';

/**
 * A dot in the color of a buzzer, which its team has on the screens; named if it is one of the cases' colors
 */
@Component({
  selector: 'app-buzzer-color',
  template: `<span class="dot" role="img" [style.background]="color" [attr.title]="getLabel()"
                   [attr.aria-label]="getLabel()"></span>`,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }

    .dot {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
    }
  `]
})
export class BuzzerColorComponent {
  @Input() color: string;
  /** Whether it is the color of the buzzer's case, not just the one its team gets */
  @Input() isCaseColor = false;

  public getLabel(): string {
    const name = BuzzerHelper.getCaseColorName(this.color);
    if (this.isCaseColor) {
      return name ? `Gehäuse: ${name}` : 'Farbe des Gehäuses';
    }
    return 'Farbe des Teams auf der Anzeige';
  }
}
