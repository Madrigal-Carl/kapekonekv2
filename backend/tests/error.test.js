import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { errorHandler, notFound } from '../src/middlewares/error.middleware.js';
import { AppError } from '../src/utils/AppError.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';

const app = express();
app.use(express.json());
app.get('/app-error', () => { throw new AppError(403, 'Not yours', { code: 'FORBIDDEN' }); });
app.get('/default-code', () => { throw new AppError(404, 'Order not found'); });
app.get('/dup', asyncHandler(async () => {
  throw Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyPattern: { email: 1 }, keyValue: { email: 'a@b.c' } });
}));
app.get('/dup-camel', () => { throw Object.assign(new Error('dup'), { code: 11000, keyPattern: { orderNumber: 1 } }); });
app.get('/cast', () => { throw new mongoose.Error.CastError('ObjectId', 'zzz', '_id'); });
app.get('/boom', asyncHandler(async () => { throw new Error('secret internals'); }));
app.post('/json', (req, res) => res.json(req.body));
app.use(notFound);
app.use(errorHandler);

afterEach(() => { env.NODE_ENV = 'test'; });

describe('error middleware', () => {
  it('formats AppError', async () => {
    const res = await request(app).get('/app-error');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Not yours', code: 'FORBIDDEN', errors: {} });
  });

  it('derives the code from the status', async () => {
    const res = await request(app).get('/default-code');
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('maps Mongo duplicate keys to 409 CONFLICT with the field', async () => {
    const res = await request(app).get('/dup');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'CONFLICT', errors: { email: 'Email is already taken' } });
    const camel = await request(app).get('/dup-camel');
    expect(camel.body.errors).toEqual({ orderNumber: 'Order number is already taken' });
  });

  it('maps CastError to 404', async () => {
    const res = await request(app).get('/cast');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('hides unknown errors behind SERVER_ERROR', async () => {
    env.NODE_ENV = 'production';
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Something went wrong. Please try again.', code: 'SERVER_ERROR', errors: {} });
  });

  it('rejects malformed JSON as VALIDATION_ERROR', async () => {
    const res = await request(app).post('/json').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });
});
