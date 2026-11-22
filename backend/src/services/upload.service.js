import cloudinary from '../config/cloudinary.js';
import { env } from '../config/env.js';

/** Upload types buyers may sign (product and post media are seeder-only). */
export const UPLOAD_TYPES = {
  avatar: { folder: 'avatars', allowedFormats: 'jpg,jpeg,png,webp', maxBytes: 2 * 1024 * 1024 },
  receipt: { folder: 'receipts', allowedFormats: 'jpg,jpeg,png,webp,heic,heif', maxBytes: 5 * 1024 * 1024 },
};

/** Cloudinary folder of a user's uploads of this type, e.g. `kapekonek/receipts/<userId>`. */
export const uploadFolder = (type, userId) => `${env.CLOUDINARY_ROOT_FOLDER}/${UPLOAD_TYPES[type].folder}/${userId}`;

/**
 * Whether `{ url, publicId }` is an upload of this type from this user's own folder on our Cloudinary cloud.
 * @param {{ _id: unknown }} user
 * @param {'avatar'|'receipt'} type
 * @param {{ url: string, publicId: string }} asset
 */
export const isOwnUpload = (user, type, { url, publicId }) =>
  publicId.startsWith(`${uploadFolder(type, user._id)}/`) &&
  url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`) &&
  url.includes(`/${publicId}`);

/**
 * Signed params for a direct browser upload into the user's own folder.
 * `maxBytes` is for the client's check; Cloudinary can't enforce size on a signed upload.
 * @param {{ _id: unknown }} user
 * @param {'avatar'|'receipt'} type
 */
export function createUploadSignature(user, type) {
  const { allowedFormats, maxBytes } = UPLOAD_TYPES[type];
  const folder = uploadFolder(type, user._id);
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, allowed_formats: allowedFormats, unique_filename: true, use_filename: true },
    env.CLOUDINARY_API_SECRET,
  );
  return {
    url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
    allowedFormats,
    useFilename: true,
    uniqueFilename: true,
    maxBytes,
  };
}
