import {t} from '../i18n/i18n';
import {FileExtensionsService, IMediaDetails, MediaHelper} from '../../../../shared/shared';

/**
 * What the master's controls and the screens call a question's media, and its icon
 */
export class MediaKindHelper {
  private constructor() {
    // making it private to avoid this class being instantiated
  }

  public static isAudio(media: IMediaDetails | undefined): boolean {
    return !!media && !MediaHelper.isSlideshow(media) && FileExtensionsService.isAudio(media.fileSrc);
  }

  /**
   * Which texts are about the media: "media.kind.<kind>" is its name, "media.after.<kind>" says "after the video"
   */
  public static getKind(media: IMediaDetails | undefined): 'slideshow' | 'video' | 'audio' | 'image' {
    if (MediaHelper.isSlideshow(media)) {
      return 'slideshow';
    }
    if (MediaHelper.isVideo(media)) {
      return 'video';
    }
    return this.isAudio(media) ? 'audio' : 'image';
  }

  public static getName(media: IMediaDetails | undefined): string {
    return t('media.kind.' + MediaKindHelper.getKind(media));
  }

  public static getIcon(media: IMediaDetails | undefined): string {
    if (MediaHelper.isSlideshow(media)) {
      return 'burst_mode';
    }
    if (MediaHelper.isVideo(media)) {
      return 'movie';
    }
    return this.isAudio(media) ? 'audiotrack' : 'image';
  }
}
