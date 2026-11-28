import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/clients/cloudinary.client.js', () => ({ getUploadedAsset: vi.fn(), destroyImage: vi.fn() }));

const { destroyImage, getUploadedAsset } = await import('../src/clients/cloudinary.client.js');
const { assertUploadAllowed, createUploadSignature } = await import('../src/services/upload.service.js');

const MB = 1024 * 1024;
const user = { _id: 'u1' };
const asset = (format, bytes, resourceType = 'image') => ({ bytes, format, resourceType, originalFilename: 'doc' });

beforeEach(() => vi.clearAllMocks());

describe('farmer_document uploads', () => {
  it('signs images and pdf into the user’s own folder', () => {
    const sig = createUploadSignature(user, 'farmer_document');
    expect(sig).toMatchObject({ folder: 'kapekonek/farmer-documents/u1', kinds: ['image', 'file'] });
    expect(sig.allowedFormats.split(',')).toEqual(expect.arrayContaining(['jpg', 'png', 'pdf']));
    expect(sig.allowedFormats).not.toMatch(/mp4/);
  });

  it('accepts a 10 MB pdf and refuses one byte more, deleting it', async () => {
    getUploadedAsset.mockResolvedValueOnce(asset('pdf', 10 * MB));
    await expect(assertUploadAllowed('farmer_document', 'p1', 'documents')).resolves.toEqual({ kind: 'file', bytes: 10 * MB, name: 'doc.pdf' });
    getUploadedAsset.mockResolvedValueOnce(asset('pdf', 10 * MB + 1));
    await expect(assertUploadAllowed('farmer_document', 'p2', 'documents')).rejects.toMatchObject({ statusCode: 422, code: 'FILE_TOO_LARGE' });
    expect(destroyImage).toHaveBeenCalledWith('p2');
  });

  it('refuses a video, which only Hub posts may carry', async () => {
    getUploadedAsset.mockResolvedValueOnce(asset('mp4', 1 * MB, 'video'));
    await expect(assertUploadAllowed('farmer_document', 'v1', 'documents')).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });
  });
});

describe('image-only purposes', () => {
  it('refuse a pdf receipt', async () => {
    getUploadedAsset.mockResolvedValueOnce(asset('pdf', 1000));
    await expect(assertUploadAllowed('receipt', 'r1', 'receipt')).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });
    expect(createUploadSignature(user, 'receipt').kinds).toEqual(['image']);
  });
});
