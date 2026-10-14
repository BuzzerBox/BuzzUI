import {Component, HostListener, Input, OnDestroy, OnInit} from '@angular/core';
import {VgApiService} from '@videogular/ngx-videogular/core';
import {EMediaStates, IMediaDetails, IMediaVolume, FileExtensionsService, MediaHelper, PacketHelper} from '../../../../../../shared/shared';
import {Subscription} from 'rxjs';
import {SubscriptionsHelper} from '../../../helper/subscriptions.helper';
import {GameService} from '../../../services/game.service';

@Component({
    selector: 'app-media-question',
    templateUrl: './media-question.component.html',
    styleUrls: ['./media-question.component.css'],
    standalone: false
})
export class MediaQuestionComponent implements OnInit, OnDestroy {
  @Input() media: IMediaDetails;
  api: VgApiService;

  private mediaUpdateSubscription: Subscription;
  private mediaVolumeSubscription: Subscription;
  private mediaVolume: IMediaVolume = PacketHelper.getDefaultMediaVolume();
  public mediaVisible = false;
  public fullscreen = false;
  // set when the browser refused to play with sound because nobody has interacted with the page yet
  public soundBlocked = false;
  // only for slideshows: the image that is shown
  public slideIndex = 0;


  constructor(private game: GameService) {
  }

  ngOnInit(): void {
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        this.fullscreen = !!packet.mediaQuestionState.fullscreen;
        this.slideIndex = packet.mediaQuestionState.slideIndex ?? 0;
        this.preloadNextSlide();
        switch (packet.mediaQuestionState.mediaState) {
          // this component is reused when the next question also has media, so hide whatever was shown before
          case EMediaStates.NO_MEDIA:
          case EMediaStates.HIDDEN:
          case EMediaStates.PAUSED:
            this.pausePlayback();
            break;
          case EMediaStates.PLAYING:
            this.startPlayback();
            break;
          case EMediaStates.RESET:
            this.restartPlayback();
            break;
          case EMediaStates.FINISHED:
            if (this.isSlideshow()) {
              // a complete slideshow keeps showing its last image
              this.mediaVisible = true;
              break;
            }
            this.pausePlayback();
            if (this.api && this.api.getDefaultMedia()) {
              this.api.getDefaultMedia().currentTime = 0;
            }
            break;
        }
      }
    );
    this.mediaVolumeSubscription = this.game.observeMediaVolume().subscribe(
      (mediaVolume) => {
        this.mediaVolume = mediaVolume;
        this.applyVolume();
      }
    );
  }

  ngOnDestroy(): void {
    SubscriptionsHelper.cleanUpSubscriptions(this.mediaUpdateSubscription, this.mediaVolumeSubscription);
  }

  onPlayerReady(api: VgApiService): void {
    this.api = api;
    this.api.getDefaultMedia().subscriptions.ended.subscribe(
      // the media ended: leave fullscreen, there is nothing left to show in it
      () => this.game.finishMedia({fullscreen: false})
    );
    // When the next question also has a video (or audio), the player stays and only the file changes. Videogular then
    // reloads the media shortly after, which cancels a playback started right after the question change. So start it
    // again once the new file is loaded, if it is supposed to be playing.
    this.api.getDefaultMedia().subscriptions.loadedMetadata.subscribe(
      () => {
        if (this.mediaVisible) {
          this.playMedia();
        }
      }
    );
    this.applyVolume();
    if (this.mediaVisible) {
      this.playMedia();
    }
  }

  private applyVolume(): void {
    const media = this.api?.getDefaultMedia();
    if (!media) {
      return;
    }
    const wasPlaying = !media.elem.paused;
    media.elem.volume = this.mediaVolume.volume;
    media.elem.muted = this.mediaVolume.muted || this.soundBlocked;
    if (wasPlaying && !media.elem.muted) {
      // browsers pause a video that gets unmuted before the user interacted with the page, so resume it
      this.playWithMutedFallback(media.elem.play(), media);
    }
  }

  private playMedia(): void {
    const media = this.api?.getDefaultMedia();
    if (!media) {
      return;
    }
    this.playWithMutedFallback(media.play(), media);
  }

  /**
   * Browsers only allow playback with sound once the user interacted with the page (e.g. a laptop screen that was
   * reloaded). In that case, play muted instead and unmute on the next click or keypress, see enableSound().
   */
  private playWithMutedFallback(playPromise: Promise<void> | undefined, media: ReturnType<VgApiService['getDefaultMedia']>): void {
    playPromise?.catch((error: DOMException) => {
      if (error?.name !== 'NotAllowedError' || media.elem.muted) {
        return;
      }
      this.soundBlocked = true;
      media.elem.muted = true;
      // videogular still considers its own play() call pending at this point and would ignore another one
      media.elem.play().catch(() => {});
    });
  }

  @HostListener('document:click')
  @HostListener('document:keydown')
  enableSound(): void {
    if (!this.soundBlocked) {
      return;
    }
    this.soundBlocked = false;
    this.applyVolume();
  }

  startPlayback(): void {
    this.playMedia();
    this.mediaVisible = true;
  }

  pausePlayback(): void {
    if (this.api && this.api.getDefaultMedia()) {
      this.api.getDefaultMedia().pause();
    }
    this.mediaVisible = false;
  }

  restartPlayback(): void {
    if (this.api && this.api.getDefaultMedia()) {
      this.api.getDefaultMedia().currentTime = 0;
      this.playMedia();
    }
    this.mediaVisible = true;

  }

  public getExtension(path: string): string {
    return '.' + path.split('.').pop();
  }

  public isVideo(): boolean {
    return FileExtensionsService.isVideo(this.media.fileSrc);
  }

  public isImage(): boolean {
    return FileExtensionsService.isImage(this.media.fileSrc);
  }

  public isSlideshow(): boolean {
    return MediaHelper.isSlideshow(this.media);
  }

  public getCurrentSlide(): string {
    const slides = this.media.slides;
    return slides[Math.min(this.slideIndex, slides.length - 1)];
  }

  /**
   * Loads the next image of a slideshow ahead, so it appears without delay when the master advances
   */
  private preloadNextSlide(): void {
    const next = this.media?.slides?.[this.slideIndex + 1];
    if (next) {
      new Image().src = next;
    }
  }

  public isAudio(): boolean {
    return FileExtensionsService.isAudio(this.media.fileSrc);
  }

  public isPlayable(): boolean {
    return FileExtensionsService.isPlayable(this.media.fileSrc);
  }
}
