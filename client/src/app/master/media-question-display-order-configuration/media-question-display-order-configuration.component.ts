import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {EMediaStates, EQuestionAnswerStates, IMediaQuestionState, MediaHelper, TMediaKind} from '../../../../../shared/shared';
import {FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

type MediaAnswerPreset = 'MEDIA_FIRST' | 'PLAY_HIDE_ANSWERS' | 'HIDE_BOTH' | 'SHOW_ANSWERS';

// HIDDEN rather than PAUSED hides the media: a paused video shows its picture (e.g. its first frame)
const PRESET_TO_STATE: Record<MediaAnswerPreset, Pick<IMediaQuestionState, 'mediaState' | 'answerState'>> = {
  MEDIA_FIRST:       { mediaState: EMediaStates.PLAYING, answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA },
  PLAY_HIDE_ANSWERS: { mediaState: EMediaStates.PLAYING, answerState: EQuestionAnswerStates.HIDDEN },
  HIDE_BOTH:         { mediaState: EMediaStates.HIDDEN,  answerState: EQuestionAnswerStates.HIDDEN },
  SHOW_ANSWERS:      { mediaState: EMediaStates.PAUSED,  answerState: EQuestionAnswerStates.SHOWN },
};

function presetFromConfig(config: IMediaQuestionState): MediaAnswerPreset {
  if (config?.answerState === EQuestionAnswerStates.HIDDEN) {
    // games saved before HIDE_BOTH used HIDDEN have it PAUSED
    return config.mediaState === EMediaStates.PLAYING ? 'PLAY_HIDE_ANSWERS' : 'HIDE_BOTH';
  }
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
    const options: { label: string; key: MediaAnswerPreset }[] = [
      { label: this.mediaKind === 'slideshow' ? 'Erstes Bild zeigen, Antworten nach dem letzten' : this.hasEnd ? 'Abspielen, Antworten danach' : 'Bild zeigen', key: 'MEDIA_FIRST' },
    ];
    // video and audio: the master shows the answers when they like, not when the media ends
    if (this.mediaKind === 'playable') {
      options.push({ label: 'Abspielen, Antworten verbergen', key: 'PLAY_HIDE_ANSWERS' });
    }
    options.push(
      { label: 'Beides verbergen', key: 'HIDE_BOTH' },
      { label: 'Antworten zeigen', key: 'SHOW_ANSWERS' },
    );
    return options;
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
    const preset = this.questionConfig.get('preset');
    if (this.mediaKind !== 'playable' && preset.value === 'PLAY_HIDE_ANSWERS') {
      preset.setValue('HIDE_BOTH');
    }
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
