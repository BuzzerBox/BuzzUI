/**
 * What the media picker selected: a file, or a folder whose images form a slideshow
 */
export interface IMediaSelection {
  /**
   * Path of the file or folder below the media root; empty if nothing is selected
   */
  path: string;
  /**
   * Only for slideshows: paths of the folder's images, in the order they are shown
   */
  slides?: string[];
}
