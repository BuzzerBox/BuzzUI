import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {EMediaStates, EQuestionAnswerStates, IDirectoryTree, IMediaQuestionState} from '../../../../../shared/shared';
import {FormControl, FormGroup} from "@angular/forms";

@Component({
  selector: 'app-media-question-display-order-configuration',
  templateUrl: './media-question-display-order-configuration.component.html',
  styleUrls: ['./media-question-display-order-configuration.component.css']
})
export class MediaQuestionDisplayOrderConfigurationComponent implements OnInit {
  initialQuestionState: IMediaQuestionState;
  public questionConfig: FormGroup;
  @Output() questionConfigChange: EventEmitter<IMediaQuestionState> = new EventEmitter<IMediaQuestionState>();
  @Input() initialConfig: IMediaQuestionState;

  questionAnswerOptions = [
    {label: 'Show', key: EQuestionAnswerStates.SHOWN},
    {label: 'Hide', key: EQuestionAnswerStates.HIDDEN},
    {label: 'Reveal after Media', key: EQuestionAnswerStates.WAIT_FOR_MEDIA}
  ];
  mediaOptions = [
    {label: 'Play', key: EMediaStates.PLAYING},
    {label: 'Hide / Pause', key: EMediaStates.PAUSED},
  ];

  defaultConfig: IMediaQuestionState = {
    answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA,
    mediaState: EMediaStates.PAUSED,
    questionState: EQuestionAnswerStates.SHOWN
  };
  constructor() {
    let config = this.defaultConfig;
    if (this.initialConfig) {
      config = this.initialConfig;
    }

    this.questionConfig = new FormGroup({
      questionState: new FormControl(config.questionState),
      mediaState: new FormControl(config.mediaState),
      answerState: new FormControl(config.answerState),
    });
    this.questionConfig.valueChanges.subscribe(x => {
      this.questionConfigChange.emit(x);
    });
  }

  ngOnInit(): void {
  }

}
