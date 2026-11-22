import { destroyImage, getUploadedAsset } from '../clients/cloudinary.client.js';
import cloudinary from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { kindForPurpose, UPLOAD_RULES, uploadRule } from '../schemas/rules.js';
import { AppError } from '../utils/AppError.js';

/** Upload purposes buyers may sign (product and post media are seeder-only) and their Cloudinary folders. */
export const UPLOAD_FOLDERS = { avatar: 'avatars', receipt: 'receipts' };

/** Cloudinary folder of a user's uploads for this purpose, e.g. `kapekonek/receipts/<userId>`. */
export const uploadFolder = (purpose, userId) => `${env.CLOUDINARY_ROOT_FOLDER}/${UPLOAD_FOLDERS[purpose]}/${userId}`;

/**
 * Whether `{ url, publicId }` is an upload for this purpose from this user's own folder on our Cloudinary cloud.
 * @param {{ _id: unknown }} user
 * @param {'avatar'|'receipt'} purpose
 * @param {{ url: string, publicId: string }} asset
 */
export const isOwnUpload = (user, purpose, { url, publicId }) =>
  publicId.startsWith(`${uploadFolder(purpose, user._id)}/`) &&
  url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`) &&
  url.includes(`/${publicId}`);

/**
 * Signed params for a direct browser upload into the user's own folder. The signature fixes the folder and
 * `allowed_formats`; `maxBytes` is for the browser's check (a signed upload can't cap size, so the server
 * re-checks the stored asset with `assertUploadAllowed`).
 * @param {{ _id: unknown }} user
 * @param {'avatar'|'receipt'} purpose
 */
export function createUploadSignature(user, purpose) {
  const kind = kindForPurpose(purpose);
  const { formats, maxBytes } = UPLOAD_RULES[kind];
  const allowedFormats = formats.join(',');
  const folder = uploadFolder(purpose, user._id);
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
    kind,
    maxBytes,
  };
}

/**
 * Re-check an upload the client sent back, from what Cloudinary stored (`bytes`, `format`, `resource_type`).
 * Over the limit or the wrong type: the asset is deleted and the request refused with
 * 422 `FILE_TOO_LARGE` / `FILE_TYPE_NOT_ALLOWED`, the message on `field`.
 * @param {'avatar'|'receipt'} purpose
 * @param {string} publicId
 * @param {string} field form field the error belongs to
 */
export async function assertUploadAllowed(purpose, publicId, field) {
  const kind = kindForPurpose(purpose);
  const asset = await getUploadedAsset(publicId, kind === 'image' ? 'image' : 'raw');
  if (!asset) throw new AppError(400, 'Please check the highlighted fields.', { errors: { [field]: 'We couldn’t find that upload. Upload it again.' } });
  const checked = uploadRule(kind).safeParse({ name: `${asset.originalFilename}.${asset.format}`, size: asset.bytes, format: asset.format });
  if (checked.success && asset.resourceType === (kind === 'image' ? 'image' : asset.resourceType)) return;
  await destroyImage(publicId);
  const issue = checked.error?.issues[0];
  const code = issue?.params?.code ?? 'FILE_TYPE_NOT_ALLOWED';
  const message = issue?.message ?? `That upload isn’t an image. Use ${UPLOAD_RULES[kind].hint.split(' · ')[0]}.`;
  throw new AppError(422, message, { code, errors: { [field]: message } });
}
