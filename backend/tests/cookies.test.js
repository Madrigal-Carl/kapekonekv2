import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { clearAuthCookies, cookieOptions, setAuthCookies } from '../src/utils/cookies.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../src/utils/tokens.js';

const user = { _id: '64b000000000000000000001', tokenVersion: 2 };
const DAY = 24 * 60 * 60 * 1000;

const app = express();
app.get('/login', (req, res) => { setAuthCookies(res, user, { remember: req.query.remember === '1' }); res.end(); });
app.get('/logout', (_req, res) => { clearAuthCookies(res); res.end(); });

const cookie = (res, name) => res.headers['set-cookie'].find((c) => c.startsWith(`${name}=`));

afterEach(() => { env.NODE_ENV = 'test'; });

describe('cookieOptions', () => {
  it('uses secure + SameSite=None in production', () => {
    env.NODE_ENV = 'production';
    expect(cookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'none', path: '/' });
  });

  it('uses SameSite=Lax outside production', () => {
    expect(cookieOptions({ maxAge: 1000 })).toEqual({ httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 1000 });
  });
});

describe('setAuthCookies', () => {
  it('keeps the refresh cookie 30 days with remember me', async () => {
    const res = await request(app).get('/login?remember=1');
    expect(cookie(res, 'accessToken')).toMatch(/Max-Age=900;/);
    expect(cookie(res, 'refreshToken')).toMatch(new RegExp(`Max-Age=${(30 * DAY) / 1000};`));
    expect(cookie(res, 'refreshToken')).toMatch(/HttpOnly/);
  });

  it('makes the refresh cookie a session cookie without remember me', async () => {
    const res = await request(app).get('/login');
    expect(cookie(res, 'refreshToken')).not.toMatch(/Max-Age|Expires/);
  });

  it('clears both cookies with the same options', async () => {
    const res = await request(app).get('/logout');
    expect(cookie(res, 'accessToken')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookie(res, 'refreshToken')).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('tokens', () => {
  it('carries the user id and tokenVersion', () => {
    expect(verifyAccessToken(signAccessToken(user))).toMatchObject({ sub: user._id, tv: 2 });
    expect(verifyRefreshToken(signRefreshToken(user, { remember: true }))).toMatchObject({ sub: user._id, tv: 2, rem: true });
  });

  it('rejects a token signed with the other secret', () => {
    expect(() => verifyAccessToken(signRefreshToken(user))).toThrow(expect.objectContaining({ statusCode: 401, code: 'UNAUTHENTICATED' }));
  });
});
