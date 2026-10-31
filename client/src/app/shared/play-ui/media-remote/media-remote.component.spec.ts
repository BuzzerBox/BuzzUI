import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaRemoteComponent } from './media-remote.component';
import {GameService} from '../../../services/game.service';
import {IMediaVolume} from '../../../../../../shared/shared';

describe('MediaRemoteComponent', () => {
  let component: MediaRemoteComponent;
  let fixture: ComponentFixture<MediaRemoteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaRemoteComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaRemoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('MediaRemoteComponent volume', () => {
  let component: MediaRemoteComponent;
  let setMediaVolume: jasmine.Spy;

  beforeEach(() => {
    setMediaVolume = jasmine.createSpy('setMediaVolume');
    component = new MediaRemoteComponent({setMediaVolume} as unknown as GameService);
  });

  const lastVolume = (): IMediaVolume => setMediaVolume.calls.mostRecent().args[0];

  it('shows a muted volume as 0', () => {
    component.mediaVolume = {volume: 0.6, muted: true};
    expect(component.getVolumePercent()).toBe(0);
    component.mediaVolume = {volume: 0.6, muted: false};
    expect(component.getVolumePercent()).toBe(60);
  });

  it('keeps the volume when muting, and brings it back when turning the sound on', () => {
    component.mediaVolume = {volume: 0.6, muted: false};
    component.toggleMute();
    expect(lastVolume()).toEqual({volume: 0.6, muted: true});
    component.mediaVolume = lastVolume();
    component.toggleMute();
    expect(lastVolume()).toEqual({volume: 0.6, muted: false});
  });

  it('mutes when the slider goes to 0, keeping the volume', () => {
    component.mediaVolume = {volume: 0.6, muted: false};
    component.setVolume(0);
    expect(lastVolume()).toEqual({volume: 0.6, muted: true});
  });

  it('turns the sound on when the slider leaves 0', () => {
    component.mediaVolume = {volume: 0.6, muted: true};
    component.setVolume(30);
    expect(lastVolume()).toEqual({volume: 0.3, muted: false});
  });

  it('turns the sound on at the default volume when there is none to bring back', () => {
    component.mediaVolume = {volume: 0, muted: true};
    component.toggleMute();
    expect(lastVolume()).toEqual({volume: 1, muted: false});
  });
});
