/**
 * Volume of question media on all screens. It applies to the whole game, so changing the question keeps it.
 */
export interface IMediaVolume {
    /**
     * Between 0 and 1
     */
    volume: number;
    muted: boolean;
}
