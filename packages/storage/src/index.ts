/**
 * GC-Stats — index module
 *
 * Package entrypoint: re-exports the S3 client helpers and the image,
 * logo, news, and emote storage modules.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export {
  getS3Client,
  getBucket,
  publicUrl,
  tryPublicUrl,
  putObject,
  deleteObject,
  deleteObjects,
  objectExists,
  copyObjectWithinBucket,
} from "./s3";
export { convertToWebp, validateImageBuffer, MAX_IMAGE_BYTES } from "./image";
export type { ImageFit, WebpOptions, ImageValidationError, ImageValidationResult } from "./image";
export { LOGO_FOLDERS, storeLogoPair, replaceLogoFiles, tryStoreLogoPair, tryReplaceLogoFiles, deleteLogoFiles, logoUrl } from "./logos";
export type { LogoEntityType, LogoVariant, StoredLogo } from "./logos";
export { storeNewsImage, deleteNewsImage, newsImageUrl } from "./news";
export type { StoredNewsImage } from "./news";
export { emoteImageUrl, isSupportedEmoteMime, storeEmoteImage, copyTeamLogoAsEmote, deleteEmoteImageFile } from "./emotes";
export type { StoredEmoteImage } from "./emotes";
