/**
 * What the server found when it checked the signature of an update bundle against the public key of the box
 */
export enum EUpdateSignatures {
    VALID = 'valid',
    /**
     * The bundle has no signature (scripts/create-update-bundle.sh --unsigned)
     */
    MISSING = 'missing',
    /**
     * The bundle was signed with another key, or it was changed after signing
     */
    INVALID = 'invalid',
    /**
     * The box has no public key to check signatures with
     */
    NO_PUBLIC_KEY = 'no-public-key'
}
