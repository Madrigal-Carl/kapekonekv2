import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import { validate } from '../src/middlewares/validate.js';

const app = express();
app.use(express.json());
app.post(
  '/items/:id',
  validate({
    params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id') }),
    query: z.object({ limit: z.coerce.number().int().max(24).default(12) }),
    body: z.object({ name: z.string().min(2, 'Name is too short'), items: z.array(z.object({ quantity: z.number().positive('Must be more than 0') })).default([]) }),
  }),
  (req, res) => res.json({ body: req.body, params: req.params, query: req.query }),
);
app.use(errorHandler);

const id = 'a'.repeat(24);

describe('validate()', () => {
  it('replaces body, params and query with parsed data', async () => {
    const res = await request(app).post(`/items/${id}?limit=5`).send({ name: 'Beans', extra: 'dropped' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ body: { name: 'Beans', items: [] }, params: { id }, query: { limit: 5 } });
  });

  it('applies query defaults', async () => {
    const res = await request(app).post(`/items/${id}`).send({ name: 'Beans' });
    expect(res.body.query).toEqual({ limit: 12 });
  });

  it('returns a flat field → message map', async () => {
    const res = await request(app).post('/items/nope?limit=99').send({ name: 'B', items: [{ quantity: 0 }] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: { id: 'Invalid id', limit: expect.any(String), name: 'Name is too short', 'items.0.quantity': 'Must be more than 0' },
    });
  });
});
