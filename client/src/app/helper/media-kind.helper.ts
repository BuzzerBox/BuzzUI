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

  public static getName(media: IMediaDetails | undefined): string {
    if (MediaHelper.isSlideshow(media)) {
      return 'Bildserie';
    }
    if (MediaHelper.isVideo(media)) {
      return 'Video';
    }
    return this.isAudio(media) ? 'Audio' : 'Bild';
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
