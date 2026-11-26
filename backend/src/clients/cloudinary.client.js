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

/**
 * What Cloudinary stored for an upload (Admin API), or null when there is no such asset.
 * @param {string} publicId
 * @param {'image'|'video'|'raw'} [resourceType]
 * @returns {Promise<{ bytes: number, format: string, resourceType: string, originalFilename: string, width?: number, height?: number, duration?: number } | null>}
 */
export async function getUploadedAsset(publicId, resourceType = 'image') {
  try {
    const r = await cloudinary.api.resource(publicId, { resource_type: resourceType });
    return { bytes: r.bytes, format: r.format, resourceType: r.resource_type, originalFilename: r.original_filename ?? publicId.split('/').at(-1), width: r.width, height: r.height, duration: r.duration };
  } catch (error) {
    if (error?.error?.http_code === 404 || error?.http_code === 404) return null;
    throw error;
  }
}

/**
 * Delete an uploaded image. Best effort: a failure is logged, never thrown, so the user's change still goes through.
 * @param {string} publicId
 */
export async function destroyImage(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  } catch (error) {
    console.error(`[cloudinary] could not delete ${publicId}: ${error.message}`);
  }
}
