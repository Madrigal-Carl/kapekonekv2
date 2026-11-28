/** Bean photos in the uploader's own folder (the Cloudinary client is mocked in tests). */
export const photosOf = (userId, count = 2) =>
  Array.from({ length: count }, (_, i) => ({
    url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/bean-photos/${userId}/p${i}.jpg`,
    publicId: `kapekonek/bean-photos/${userId}/p${i}`,
  }));

/** A listing body (PHASE-2-SPEC §3.5): weight in kg, price in centavos per kg. */
export const beanBody = (uploaderId, fields = {}) => ({
  variety: 'liberica',
  form: 'dried_cherry',
  weightKg: 2,
  pricePerKgCentavos: 18_000,
  photos: photosOf(uploaderId),
  note: 'Sun-dried 12 days',
  ...fields,
});

/** The Cloudinary mock every bean test uses: every upload is a 400 KB jpg. */
export const cloudinaryMock = () => ({
  getUploadedAsset: async (publicId) => ({ bytes: 400_000, format: 'jpg', resourceType: 'image', originalFilename: publicId.split('/').pop() }),
  destroyImage: async () => {},
});
