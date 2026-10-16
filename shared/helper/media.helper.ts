import {IMediaDetails} from '../interfaces/IMediaDetails';
import {FileExtensionsService} from '../services/file-extensions.service';

export class MediaHelper {
    private constructor() {
        // hide public constructor
    }

    public static isSlideshow(media: IMediaDetails | undefined): boolean {
        return !!media?.slides?.length;
    }

    /**
     * Video or audio, which plays and can be paused (as opposed to an image or a slideshow)
     */
    public static isPlayable(media: IMediaDetails | undefined): boolean {
        return !this.isSlideshow(media) && !!media?.fileSrc && FileExtensionsService.isPlayable(media.fileSrc);
    }

    public static isVideo(media: IMediaDetails | undefined): boolean {
        return !this.isSlideshow(media) && !!media?.fileSrc && FileExtensionsService.isVideo(media.fileSrc);
    }

    /**
     * Whether the media ends, so a question and answers can wait for it: video, audio and slideshows
     */
    public static hasEnd(media: IMediaDetails | undefined): boolean {
        return this.isSlideshow(media) || (!!media?.fileSrc && FileExtensionsService.isPlayable(media.fileSrc));
    }
}
