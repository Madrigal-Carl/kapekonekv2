import request from 'supertest';

/** Sign in a seeded account by its handle. */
export async function signedIn(app, handle) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: `kapekonek.${handle}@gmail.com`, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

/** Sign up a farmer through the API and mark their email verified. */
export async function registerFarmer(app, User, username) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    firstName: username[0].toUpperCase() + username.slice(1), lastName: 'Farmer', username, email: `${username}@example.com`,
    password: 'KapeKonek@123', role: 'farmer', contactNumber: '09175550100', acceptTerms: true,
  }).expect(201);
  const user = await User.findOneAndUpdate({ username }, { emailVerifiedAt: new Date() }, { new: true }).lean();
  return { agent, user };
}

/** Uploaded documents in the user's own folder (the Cloudinary client is mocked in tests). */
export const documentsOf = (userId) => ({
  validId: { url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/farmer-documents/${userId}/id.jpg`, publicId: `kapekonek/farmer-documents/${userId}/id` },
  landProof: { url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/farmer-documents/${userId}/land.pdf`, publicId: `kapekonek/farmer-documents/${userId}/land` },
});

/** Kaluppa sets up associations: Santa Cruz (manager.santacruz), Boac (manager.unassigned), Gasan (no Group Manager). */
export async function setUpAssociations(app, User) {
  const kaluppa = await signedIn(app, 'kaluppa');
  const manager = async (username) => String((await User.findOne({ username }))._id);
  const add = async (name, municipality, groupManagerId = null) =>
    (await kaluppa.post('/api/associations').send({ name, municipality, groupManagerId }).expect(201)).body.data;
  return {
    kaluppa,
    santacruz: await add('Santa Cruz Growers', 'Santa Cruz', await manager('manager.santacruz')),
    boac: await add('Boac Growers', 'Boac', await manager('manager.unassigned')),
    gasan: await add('Gasan Growers', 'Gasan'),
  };
}
