export class FileExtensionsService {
    private static imageExtenions: string[] = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
    private static videoExtensions: string[] = ['.mp4'];
    private static audioExtensions: string[] = ['.mp3', '.wav', '.ogg', '.m4a'];

    public static getImageExtensions(): string[] {
        return this.imageExtenions;
    }

    public static getVideoExtensions(): string[] {
        return this.videoExtensions;
    }

    public static getAudioExtensions(): string[] {
        return this.audioExtensions;
    }

    public static getExtensions(): string[] {
        return this.videoExtensions.concat(this.imageExtenions, this.audioExtensions);
    }

    /**
     * Whether files with this extension (as in ".mp3", any case) can be used as question media
     */
    public static isSupportedExtension(extension: string): boolean {
        return !!extension && this.getExtensions().includes(extension.toLowerCase());
    }

    public static getExtension(path: string): string {
        return '.' + path.split('.').pop().toLowerCase();
    }

    public static isVideo(path: string): boolean {
        return FileExtensionsService.getVideoExtensions().includes(this.getExtension(path));
    }

    public static isImage(path: string): boolean {
        return FileExtensionsService.getImageExtensions().includes(this.getExtension(path));
    }

    public static isAudio(path: string): boolean {
        return FileExtensionsService.getAudioExtensions().includes(this.getExtension(path));
    }

    /**
     * Video or audio: media that is played and ends, as opposed to images
     */
    public static isPlayable(path: string): boolean {
        return this.isVideo(path) || this.isAudio(path);
    }
}
