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
     * Whether the media ends, so a question and answers can wait for it: video, audio and slideshows
     */
    public static hasEnd(media: IMediaDetails | undefined): boolean {
        return this.isSlideshow(media) || (!!media?.fileSrc && FileExtensionsService.isPlayable(media.fileSrc));
    }
}
