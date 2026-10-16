export class FormatHelper {
  private constructor() {
    // making it private to avoid this class being instantiated
  }

  /**
   * A size in bytes for humans, like "1.5 MB"
   */
  public static formatBytes(bytes: number, decimals = 1): string {
    if (!bytes) {
      return '0 Bytes';
    }
    const k = 1024;
    const dm = decimals <= 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * An ISO date as day and time, like "15.10.2026, 20:30"
   */
  public static formatDateTime(isoDate: string): string {
    const date = new Date(isoDate);
    return isNaN(date.getTime()) ? '' : date.toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'});
  }

  /**
   * A name for a new savegame, like "Spielstand 2026-10-15 20.30"
   */
  public static makeTimestampedName(prefix: string, date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${prefix} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}.${pad(date.getMinutes())}`;
  }
}
