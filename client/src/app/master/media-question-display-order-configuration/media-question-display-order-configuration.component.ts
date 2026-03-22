import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {EMediaStates, EQuestionAnswerStates, FileExtensionsService, IMediaQuestionState} from '../../../../../shared/shared';
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
  @Input() mediaSrc: string = '';

  public questionConfig: FormGroup;

  private readonly allQuestionStateOptions = [
    { label: 'Show',               key: EQuestionAnswerStates.SHOWN },
    { label: 'Hide',               key: EQuestionAnswerStates.HIDDEN },
    { label: 'Reveal after media', key: EQuestionAnswerStates.WAIT_FOR_MEDIA },
  ];

  readonly defaultConfig: IMediaQuestionState = {
    mediaState:    EMediaStates.PLAYING,
    questionState: EQuestionAnswerStates.SHOWN,
    answerState:   EQuestionAnswerStates.WAIT_FOR_MEDIA,
  };

  get isVideo(): boolean {
    return FileExtensionsService.isVideo(this.mediaSrc);
  }

  get questionStateOptions() {
    if (this.isVideo) { return this.allQuestionStateOptions; }
    return this.allQuestionStateOptions.filter(o => o.key !== EQuestionAnswerStates.WAIT_FOR_MEDIA);
  }

  get presetOptions(): { label: string; key: MediaAnswerPreset }[] {
    return [
      { label: this.isVideo ? 'Play media, reveal answers after' : 'Show Image', key: 'MEDIA_FIRST' },
      { label: 'Hide both',    key: 'HIDE_BOTH' },
      { label: 'Show answers', key: 'SHOW_ANSWERS' },
    ];
  }

  constructor() {}

  ngOnInit(): void {
    const config = this.initialConfig ?? this.defaultConfig;
    const preset = presetFromConfig(config);

    this.questionConfig = new FormGroup({
      questionState: new FormControl(config.questionState),
      preset:        new FormControl(preset),
    });

    this.questionConfig.valueChanges.subscribe(() => this.emit());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.questionConfig || !changes['mediaSrc']) { return; }
    if (!this.isVideo) {
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
