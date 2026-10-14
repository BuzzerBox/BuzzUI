export interface IMediaDetails{
    /**
     * The media file, or for a slideshow the folder its images come from
     */
    fileSrc: string;
    /**
     * Only for slideshows: the images, in the order they are shown
     */
    slides?: string[];
}
