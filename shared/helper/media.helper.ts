import {IMediaDetails} from '../interfaces/IMediaDetails';
import {IQuestion} from '../interfaces/IQuestion';
import {IMediaQuestionDefaults, IMediaQuestionState, TMediaKind} from '../interfaces/IMediaQuestionState';
import {EMediaStates} from '../enums/EMediaStates';
import {EQuestionAnswerStates} from '../enums/EQuestionAnswerStates';
import {FileExtensionsService} from '../services/file-extensions.service';
import {IRound} from '../interfaces/IRound';
import {RoundRulesHelper} from '../rules/round-rules.helper';

export class MediaHelper {
    public static readonly MEDIA_KINDS: TMediaKind[] = ['image', 'playable', 'slideshow'];

    private constructor() {
        // hide public constructor
    }

    /**
     * How a media question starts if neither the game nor the question says otherwise: the media plays (or is shown)
     * with the question, and the answers come once it ended
     */
    public static getDefaultInitialConfig(): IMediaQuestionState {
        return {
            mediaState: EMediaStates.PLAYING,
            questionState: EQuestionAnswerStates.SHOWN,
            answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA
        };
    }

    /**
     * The defaults of a game for every kind of media, filling in what the game doesn't set
     */
    public static completeMediaDefaults(defaults: Partial<IMediaQuestionDefaults> | undefined): IMediaQuestionDefaults {
        return {
            image: {...(defaults?.image ?? this.getDefaultInitialConfig())},
            playable: {...(defaults?.playable ?? this.getDefaultInitialConfig())},
            slideshow: {...(defaults?.slideshow ?? this.getDefaultInitialConfig())}
        };
    }

    /**
     * The kind of the media, or null if there is none
     */
    public static getMediaKind(media: IMediaDetails | undefined): TMediaKind | null {
        if (this.isSlideshow(media)) {
            return 'slideshow';
        }
        if (!media?.fileSrc) {
            return null;
        }
        return FileExtensionsService.isPlayable(media.fileSrc) ? 'playable' : 'image';
    }

    /**
     * How the question starts: its own config, or else the game's default for its kind of media. Undefined for
     * questions without media.
     */
    public static getInitialConfig(question: IQuestion, defaults: Partial<IMediaQuestionDefaults> | undefined): IMediaQuestionState | undefined {
        const kind = this.getMediaKind(question.mediaDetails);
        if (kind == null) {
            return undefined;
        }
        return question.initialConfig ?? defaults?.[kind] ?? this.getDefaultInitialConfig();
    }

    /**
     * The rounds as they are played: every media question with the config it starts with
     */
    public static applyMediaDefaults(rounds: IRound[], defaults: Partial<IMediaQuestionDefaults> | undefined): IRound[] {
        return rounds.map(round => RoundRulesHelper.get(round).mapQuestions(round, question => {
            const initialConfig = this.getInitialConfig(question, defaults);
            return initialConfig ? {...question, initialConfig: {...initialConfig}} : question;
        }));
    }

    public static isSameInitialConfig(a: IMediaQuestionState | undefined, b: IMediaQuestionState | undefined): boolean {
        return a?.mediaState === b?.mediaState && a?.questionState === b?.questionState && a?.answerState === b?.answerState;
    }

    /**
     * The media files the questions of the rounds show that aren't there: the images of a slideshow, the file of other
     * questions. The paths are relative to the game's media folder, like existingPaths, which holds every file and
     * folder in it. Rounds and questions are counted from 1.
     */
    public static findMissingMedia(rounds: IRound[], existingPaths: Set<string>): {roundNumber: number, questionNumber: number, path: string}[] {
        const normalize = (mediaPath: string) => mediaPath.split('/').filter(segment => segment !== '').join('/');
        return (rounds ?? []).flatMap((round, roundIndex) => RoundRulesHelper.get(round).getQuestions(round).flatMap((question, index) => {
            const media = question.mediaDetails;
            const paths = this.isSlideshow(media) ? media.slides : (media?.fileSrc ? [media.fileSrc] : []);
            return paths
                .filter(mediaPath => !existingPaths.has(normalize(mediaPath)))
                .map(mediaPath => ({roundNumber: roundIndex + 1, questionNumber: index + 1, path: mediaPath}));
        }));
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
