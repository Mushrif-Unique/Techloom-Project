import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { api, db, databaseSuite, reserved, makeDue } from '../helpers.js';
import { env } from '../../src/config/env.js';
import { startExpirationWorker } from '../../src/jobs/expiration.js';
databaseSuite();
describe('operational safeguards', () => {
  it('the scheduled worker releases expired stock without an HTTP access', async () => {
    const { product, order } = await reserved();
    const interval = env.EXPIRY_INTERVAL_MS;
    env.EXPIRY_INTERVAL_MS = 1000;
    const stop = startExpirationWorker();
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await makeDue(order.id);
      await expect
        .poll(
          async () =>
            (await db.order.findUnique({ where: { id: order.id } })).status,
          { timeout: 5000, interval: 100 },
        )
        .toBe('EXPIRED');
      expect(
        (await db.product.findUnique({ where: { id: product.id } })).stock,
      ).toBe(10);
    } finally {
      await stop();
      env.EXPIRY_INTERVAL_MS = interval;
    }
  });
  it('dashboard counters include inventory restored by its lazy expiry', async () => {
    const { order } = await reserved();
    await makeDue(order.id);
    const response = await api.get('/api/dashboard');
    expect(response.status).toBe(200);
    expect(response.body.data.availableStock).toBe(10);
    expect(response.body.data.activeReservations).toBe(0);
    expect(response.body.data.recentOrders[0].status).toBe('EXPIRED');
  });
  it('requires the configured staff key before product mutations', async () => {
    const previous = env.ADMIN_API_KEY;
    env.ADMIN_API_KEY = randomUUID();
    const payload = { name: 'Staff product', price: 100, stock: 3 };
    try {
      expect((await api.post('/api/products').send(payload)).status).toBe(401);
      expect(
        (
          await api
            .post('/api/products')
            .set('X-Admin-Key', randomUUID())
            .send(payload)
        ).status,
      ).toBe(401);
      expect(
        (
          await api
            .post('/api/products')
            .set('X-Admin-Key', env.ADMIN_API_KEY)
            .send(payload)
        ).status,
      ).toBe(201);
    } finally {
      env.ADMIN_API_KEY = previous;
    }
  });
  it('enforces request size and exact CORS origin', async () => {
    expect(
      (await api.post('/api/products').send({ name: 'x'.repeat(20000) }))
        .status,
    ).toBe(413);
    const cors = await api
      .options('/api/products')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(cors.headers['access-control-allow-origin']).toBe(env.FRONTEND_URL);
    expect(cors.headers['access-control-allow-origin']).not.toBe('*');
  });
});
