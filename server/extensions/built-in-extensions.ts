import {IServerExtension} from './server-extension';
import {SerialBuzzersExtension} from './serial-buzzers/serial-buzzers.extension';

/**
 * The extensions this repository's server starts. The serial buzzers (the analog buzzers of the BuzzerBox Classic) are
 * still here until the build for the Classic takes them over; see docs/extensions.md.
 */
export const BUILT_IN_EXTENSIONS: IServerExtension[] = [
    new SerialBuzzersExtension()
];
