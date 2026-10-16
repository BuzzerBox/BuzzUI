import {IMediaDetails} from '../interfaces/IMediaDetails';
import {IQuestion} from '../interfaces/IQuestion';
import {FileExtensionsService} from '../services/file-extensions.service';

export class MediaHelper {
    private constructor() {
        // hide public constructor
    }

    /**
     * The media files the questions show that aren't there: the images of a slideshow, the file of other questions.
     * The paths are relative to the game's media folder, like existingPaths, which holds every file and folder in it.
     */
    public static findMissingMedia(questions: IQuestion[], existingPaths: Set<string>): {questionNumber: number, path: string}[] {
        const normalize = (mediaPath: string) => mediaPath.split('/').filter(segment => segment !== '').join('/');
        return (questions ?? []).flatMap((question, index) => {
            const media = question.mediaDetails;
            const paths = this.isSlideshow(media) ? media.slides : (media?.fileSrc ? [media.fileSrc] : []);
            return paths
                .filter(mediaPath => !existingPaths.has(normalize(mediaPath)))
                .map(mediaPath => ({questionNumber: index + 1, path: mediaPath}));
        });
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
