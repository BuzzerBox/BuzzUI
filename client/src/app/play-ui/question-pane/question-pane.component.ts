import {Component, Input, OnInit} from '@angular/core';
import {GameService} from '../../services/game.service';
import {IAnswer, IQuestion} from '../../../../../shared/objects/shared';

@Component({
  selector: 'app-question-pane',
  templateUrl: './question-pane.component.html',
  styleUrls: ['./question-pane.component.css']
})
export class QuestionPaneComponent implements OnInit {
  @Input() isMaster = false;
  @Input() question: IQuestion;

  constructor(private game: GameService) { }

  ngOnInit(): void {
  }

  public getCurrentQuestionNumber(): number {
    return this.game.getCurrentQuestionNumber() + 1;
  }

  public getTotalQuestionNumber(): number {
    return this.game.getQuestions().length;
  }

  public getQuestionText(): string {
    return this.question.text;
  }

  public getAnswers(): IAnswer[] {
    return this.question.answers;
  }

}
