import { Component } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent {
  title = 'client';
  constructor(private matIconRegistry: MatIconRegistry, private domSanitizer: DomSanitizer){
    this.matIconRegistry.addSvgIcon(
      `hide_answers`,
      this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/hide_answers.svg')
    );
    this.matIconRegistry.addSvgIcon(
      `show_answers`,
      this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/show_answers.svg')
    );
    this.matIconRegistry.addSvgIcon(
      `hide_question`,
      this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/hide_question.svg')
    );
    this.matIconRegistry.addSvgIcon(
      `show_question`,
      this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/show_question.svg')
    );
  }

}
