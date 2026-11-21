import cloudinary from '../config/cloudinary.js';
import { env } from '../config/env.js';

/**
 * Upload a remote file under `<root>/<path>`. With `overwrite: false` an existing asset is returned as is.
 * @param {string} url
 * @param {{ path: string, resourceType: 'image'|'video' }} options
 * @returns {Promise<{ url: string, publicId: string, width?: number, height?: number, durationSec?: number }>}
 */
export async function uploadFromUrl(url, { path, resourceType }) {
  const result = await cloudinary.uploader.upload(url, {
    public_id: `${env.CLOUDINARY_ROOT_FOLDER}/${path}`,
    resource_type: resourceType,
    overwrite: false,
    unique_filename: false,
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    durationSec: result.duration ? Math.round(result.duration) : undefined,
  };
}
