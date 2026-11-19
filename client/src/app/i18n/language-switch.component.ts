import {Component, inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {TranslocoModule} from '@jsverse/transloco';
import {TLanguage} from '../../../../shared/shared';
import {GameService} from '../services/game.service';
import {LANGUAGE_NAMES} from './i18n';
import {LanguageService} from './language.service';

/**
 * Chooses the language: of this device, and as the master also of the screens. An icon with a menu, for a toolbar.
 */
@Component({
  selector: 'app-language-switch',
  template: `
    <button mat-icon-button [matMenuTriggerFor]="languageMenu" [title]="'language.choose' | transloco"
            [attr.aria-label]="'language.choose' | transloco">
      <mat-icon>language</mat-icon>
    </button>
    <mat-menu #languageMenu="matMenu" xPosition="before">
      @for (language of languages; track language) {
        <button mat-menu-item role="menuitemradio" [attr.aria-checked]="language === getLanguage()"
                [attr.lang]="language" (click)="choose(language)">
          <mat-icon>{{language === getLanguage() ? 'radio_button_checked' : 'radio_button_unchecked'}}</mat-icon>
          <span>{{names[language]}}</span>
        </button>
      }
    </mat-menu>
  `,
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, TranslocoModule]
})
export class LanguageSwitchComponent {
  private readonly language = inject(LanguageService);
  private readonly game = inject(GameService);
  public readonly languages = this.language.languages;
  // each in its own language, so it is found by those who can't read the current one
  public readonly names = LANGUAGE_NAMES;

  public getLanguage(): TLanguage {
    return this.language.getLanguage();
  }

  public choose(language: TLanguage): void {
    this.game.setLanguage(language);
  }
}
