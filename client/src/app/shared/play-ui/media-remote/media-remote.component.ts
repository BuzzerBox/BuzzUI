import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {
  EMediaStates,
  FileExtensionsService,
  IMediaDetails,
  IMediaQuestionState, IMediaVolume, IQuestion, MediaHelper, PacketHelper
} from '../../../../../../shared/shared';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-media-remote',
    templateUrl: './media-remote.component.html',
    styleUrls: ['./media-remote.component.css'],
    standalone: false
})
export class MediaRemoteComponent implements OnInit, OnDestroy {
  @Input() question: IQuestion;
  public state: IMediaQuestionState;
  private mediaUpdateSubscription: Subscription;
  public mediaVolume: IMediaVolume;
  private mediaVolumeSubscription: Subscription;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.state = PacketHelper.getDefaultMediaState();
    if (this.question.initialConfig) {
      this.state = this.question.initialConfig;
    }
    this.mediaVolume = this.game.getCurrentMediaVolume();
    this.mediaVolumeSubscription = this.game.observeMediaVolume().subscribe(
      (mediaVolume) => this.mediaVolume = mediaVolume
    );
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        // after a restart the media is playing again (without changing the packet, it is shared)
        this.state = packet.mediaQuestionState.mediaState === EMediaStates.RESET
          ? {...packet.mediaQuestionState, mediaState: EMediaStates.PLAYING}
          : packet.mediaQuestionState;
      }
    );
  }

  ngOnDestroy(): void {
    this.mediaUpdateSubscription.unsubscribe();
    this.mediaVolumeSubscription.unsubscribe();
  }

  toggleMute(): void {
    this.game.setMediaVolume({...this.mediaVolume, muted: !this.mediaVolume.muted});
  }

  /**
   * @param percent 0 to 100, as shown on the slider
   */
  setVolume(percent: number): void {
    // moving the slider is meant to be heard, so it also unmutes
    this.game.setMediaVolume({volume: percent / 100, muted: false});
  }

  getVolumePercent(): number {
    return Math.round(this.mediaVolume.volume * 100);
  }

  play(): void {
    this.game.changeMediaState({mediaState: EMediaStates.PLAYING});
  }

  pause(): void {
    this.game.changeMediaState({mediaState: EMediaStates.PAUSED});
  }

  replay(): void {
    if (this.isSlideshow()) {
      this.game.changeMediaState({mediaState: EMediaStates.PLAYING, slideIndex: 0});
      return;
    }
    this.game.changeMediaState({mediaState: EMediaStates.RESET});
  }

  public isSlideshow(): boolean {
    return MediaHelper.isSlideshow(this.question.mediaDetails);
  }

  public getSlideCount(): number {
    return this.question.mediaDetails.slides.length;
  }

  public getSlideIndex(): number {
    return this.state.slideIndex ?? 0;
  }

  /**
   * Whether the media is visible (or playing) on the screens; a complete slideshow keeps showing its last image
   */
  public isShown(): boolean {
    return this.isPlaying() || (this.isSlideshow() && this.isFinished());
  }

  public isFinished(): boolean {
    return this.state.mediaState === EMediaStates.FINISHED;
  }

  /**
   * Shows the current image if the slideshow is hidden, otherwise the next one. After the last image, the slideshow
   * is complete, which reveals a question and answers that wait for it.
   */
  nextSlide(): void {
    if (this.isFinished()) {
      return;
    }
    if (!this.isPlaying()) {
      this.game.changeMediaState({mediaState: EMediaStates.PLAYING});
    } else if (this.getSlideIndex() < this.getSlideCount() - 1) {
      this.game.changeMediaState({mediaState: EMediaStates.PLAYING, slideIndex: this.getSlideIndex() + 1});
    } else {
      this.game.finishMedia();
    }
  }

  /**
   * Shows the previous image. From a complete slideshow, this goes back to the image before the last; a question and
   * answers that were revealed stay visible.
   */
  previousSlide(): void {
    if (this.getSlideIndex() > 0) {
      this.game.changeMediaState({mediaState: EMediaStates.PLAYING, slideIndex: this.getSlideIndex() - 1});
    }
  }

  public getNextSlideTitle(): string {
    if (!this.isPlaying()) {
      return 'Aktuelles Bild auf der Anzeige zeigen';
    }
    return this.getSlideIndex() < this.getSlideCount() - 1 ? 'Nächstes Bild' : 'Bildserie abschließen';
  }

  isPlaying(): boolean {
    return this.state.mediaState === EMediaStates.PLAYING;
  }

  isNotFinished(): boolean {
    return this.state.mediaState !== EMediaStates.FINISHED;
  }

  toggleFullscreen(): void {
    this.game.changeMediaState({fullscreen: !this.state.fullscreen});
  }

  isFullscreen(): boolean {
    return !!this.state.fullscreen;
  }

  public isVideo(): boolean {
    return FileExtensionsService.isVideo(this.question.mediaDetails.fileSrc);
  }

  public isImage(): boolean {
    return FileExtensionsService.isImage(this.question.mediaDetails.fileSrc);
  }

  public isAudio(): boolean {
    return FileExtensionsService.isAudio(this.question.mediaDetails.fileSrc);
  }

  public isPlayable(): boolean {
    return FileExtensionsService.isPlayable(this.question.mediaDetails.fileSrc);
  }


}
