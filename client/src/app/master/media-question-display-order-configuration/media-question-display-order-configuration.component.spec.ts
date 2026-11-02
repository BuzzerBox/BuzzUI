import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaQuestionDisplayOrderConfigurationComponent } from './media-question-display-order-configuration.component';
import {EMediaStates, EQuestionAnswerStates, IMediaQuestionState} from '../../../../../shared/shared';
import {SimpleChange} from '@angular/core';

describe('MediaQuestionDisplayOrderConfigurationComponent', () => {
  let component: MediaQuestionDisplayOrderConfigurationComponent;
  let fixture: ComponentFixture<MediaQuestionDisplayOrderConfigurationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaQuestionDisplayOrderConfigurationComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaQuestionDisplayOrderConfigurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('MediaQuestionDisplayOrderConfigurationComponent presets', () => {
  const make = (mediaKind: 'image' | 'playable' | 'slideshow', initialConfig?: IMediaQuestionState) => {
    const component = new MediaQuestionDisplayOrderConfigurationComponent();
    component.mediaKind = mediaKind;
    component.initialConfig = initialConfig;
    component.ngOnInit();
    const emitted: IMediaQuestionState[] = [];
    component.questionConfigChange.subscribe(config => emitted.push(config));
    return {component, emitted};
  };
  const keys = (component: MediaQuestionDisplayOrderConfigurationComponent) => component.presetOptions.map(o => o.key);

  it('offers playing without showing the answers for video and audio only', () => {
    expect(keys(make('playable').component)).toContain('PLAY_HIDE_ANSWERS');
    expect(keys(make('image').component)).not.toContain('PLAY_HIDE_ANSWERS');
    expect(keys(make('slideshow').component)).not.toContain('PLAY_HIDE_ANSWERS');
  });

  it('plays the media and keeps the answers hidden', () => {
    const {component, emitted} = make('playable');
    component.questionConfig.get('preset').setValue('PLAY_HIDE_ANSWERS');
    expect(emitted.at(-1)).toEqual(jasmine.objectContaining({mediaState: EMediaStates.PLAYING, answerState: EQuestionAnswerStates.HIDDEN}));
  });

  it('hides the media with "Beides verbergen", also a video\'s first frame', () => {
    const {component, emitted} = make('playable');
    component.questionConfig.get('preset').setValue('HIDE_BOTH');
    expect(emitted.at(-1)).toEqual(jasmine.objectContaining({mediaState: EMediaStates.HIDDEN, answerState: EQuestionAnswerStates.HIDDEN}));
  });

  it('reads the presets back from saved questions, also those saved with the media paused', () => {
    const config = (mediaState: EMediaStates): IMediaQuestionState =>
      ({mediaState, questionState: EQuestionAnswerStates.SHOWN, answerState: EQuestionAnswerStates.HIDDEN});
    expect(make('playable', config(EMediaStates.PLAYING)).component.questionConfig.get('preset').value).toBe('PLAY_HIDE_ANSWERS');
    expect(make('playable', config(EMediaStates.PAUSED)).component.questionConfig.get('preset').value).toBe('HIDE_BOTH');
    expect(make('playable', config(EMediaStates.HIDDEN)).component.questionConfig.get('preset').value).toBe('HIDE_BOTH');
  });

  it('falls back to "Beides verbergen" when the media is no longer a video or audio', () => {
    const {component} = make('playable');
    component.questionConfig.get('preset').setValue('PLAY_HIDE_ANSWERS');
    component.mediaKind = 'image';
    component.ngOnChanges({mediaKind: new SimpleChange('playable', 'image', false)});
    expect(component.questionConfig.get('preset').value).toBe('HIDE_BOTH');
  });
});
