import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {EMediaStates, EQuestionAnswerStates, IMediaQuestionState, MediaHelper, TMediaKind} from '../../../../../shared/shared';
import {FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

type MediaAnswerPreset = 'MEDIA_FIRST' | 'HIDE_BOTH' | 'SHOW_ANSWERS';

const PRESET_TO_STATE: Record<MediaAnswerPreset, Pick<IMediaQuestionState, 'mediaState' | 'answerState'>> = {
  MEDIA_FIRST:  { mediaState: EMediaStates.PLAYING, answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA },
  HIDE_BOTH:    { mediaState: EMediaStates.PAUSED,  answerState: EQuestionAnswerStates.HIDDEN },
  SHOW_ANSWERS: { mediaState: EMediaStates.PAUSED,  answerState: EQuestionAnswerStates.SHOWN },
};

function presetFromConfig(config: IMediaQuestionState): MediaAnswerPreset {
  if (config?.answerState === EQuestionAnswerStates.HIDDEN) { return 'HIDE_BOTH'; }
  if (config?.answerState === EQuestionAnswerStates.SHOWN)  { return 'SHOW_ANSWERS'; }
  return 'MEDIA_FIRST';
}

@Component({
  selector: 'app-media-question-display-order-configuration',
  templateUrl: './media-question-display-order-configuration.component.html',
  styleUrls: ['./media-question-display-order-configuration.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonToggleModule]
})
export class MediaQuestionDisplayOrderConfigurationComponent implements OnInit, OnChanges {
  @Output() questionConfigChange = new EventEmitter<IMediaQuestionState>();
  @Input() initialConfig: IMediaQuestionState;
  @Input() mediaKind: TMediaKind = 'image';

  public questionConfig: FormGroup;

  private readonly allQuestionStateOptions = [
    { label: 'Zeigen',                 key: EQuestionAnswerStates.SHOWN },
    { label: 'Verbergen',              key: EQuestionAnswerStates.HIDDEN },
    { label: 'Nach dem Medium zeigen', key: EQuestionAnswerStates.WAIT_FOR_MEDIA },
  ];

  // video, audio or a slideshow: media that ends, so the question and answers can wait for it
  get hasEnd(): boolean {
    return this.mediaKind !== 'image';
  }

  get questionStateOptions() {
    if (this.hasEnd) { return this.allQuestionStateOptions; }
    return this.allQuestionStateOptions.filter(o => o.key !== EQuestionAnswerStates.WAIT_FOR_MEDIA);
  }

  get presetOptions(): { label: string; key: MediaAnswerPreset }[] {
    return [
      { label: this.mediaKind === 'slideshow' ? 'Erstes Bild zeigen, Antworten nach dem letzten' : this.hasEnd ? 'Abspielen, Antworten danach' : 'Bild zeigen', key: 'MEDIA_FIRST' },
      { label: 'Beides verbergen', key: 'HIDE_BOTH' },
      { label: 'Antworten zeigen', key: 'SHOW_ANSWERS' },
    ];
  }

  constructor() {}

  ngOnInit(): void {
    const config = this.initialConfig ?? MediaHelper.getDefaultInitialConfig();
    const preset = presetFromConfig(config);

    this.questionConfig = new FormGroup({
      questionState: new FormControl(config.questionState),
      preset:        new FormControl(preset),
    });

    this.questionConfig.valueChanges.subscribe(() => this.emit());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.questionConfig) { return; }
    if (changes['initialConfig']) {
      // the setup list renumbers its entries, so after a reorder or delete this component can belong to a different question
      const config = this.initialConfig ?? MediaHelper.getDefaultInitialConfig();
      this.questionConfig.setValue({
        questionState: config.questionState,
        preset:        presetFromConfig(config),
      }, {emitEvent: false});
    }
    if (!changes['mediaKind']) { return; }
    if (!this.hasEnd) {
      const qs = this.questionConfig.get('questionState');
      if (qs.value === EQuestionAnswerStates.WAIT_FOR_MEDIA) {
        qs.setValue(EQuestionAnswerStates.SHOWN);
      }
    }
  }

  private emit(): void {
    const { questionState, preset } = this.questionConfig.value as { questionState: EQuestionAnswerStates; preset: MediaAnswerPreset };
    this.questionConfigChange.emit({
      questionState,
      ...PRESET_TO_STATE[preset],
    });
  }
}
