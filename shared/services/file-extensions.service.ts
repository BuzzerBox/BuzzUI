export class FileExtensionsService {
    private static imageExtenions: string[] = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
    private static videoExtensions: string[] = ['.mp4'];

    public static getImageExtensions(): string[] {
        return this.imageExtenions;
    }

    public static getVideoExtensions(): string[] {
        return this.videoExtensions;
    }

    public static getExtensions(): string[] {
        return this.videoExtensions.concat(this.imageExtenions);
    }

    public static getExtension(path: string): string {
        return '.' + path.split('.').pop();
    }

    public static isVideo(path: string): boolean {
        return FileExtensionsService.getVideoExtensions().includes(this.getExtension(path));
    }

    public static isImage(path: string): boolean {
        return FileExtensionsService.getImageExtensions().includes(this.getExtension(path));
    }
}
