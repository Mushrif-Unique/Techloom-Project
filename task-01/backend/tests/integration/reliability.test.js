import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  api,
  db,
  databaseSuite,
  reserved,
  makeDue,
  cartFor,
  pay,
} from '../helpers.js';
import { expireBatch } from '../../src/jobs/expiration.js';
import { env } from '../../src/config/env.js';
import { startExpirationWorker } from '../../src/jobs/expiration.js';
databaseSuite();
describe('operational safeguards', () => {
  it('schedules near the deadline even with a long configured sweep interval', async () => {
    const { product, order } = await reserved();
    await db.$executeRaw`UPDATE "Reservation" SET "createdAt" = date_trunc('milliseconds', clock_timestamp()) - interval '299 seconds', "expiresAt" = date_trunc('milliseconds', clock_timestamp()) + interval '1 second' WHERE "orderId" = ${order.id}::uuid`;
    const previous = env.EXPIRY_INTERVAL_MS;
    env.EXPIRY_INTERVAL_MS = 30000;
    const stop = startExpirationWorker();
    try {
      await expect
        .poll(
          async () =>
            (await db.product.findUnique({ where: { id: product.id } })).stock,
          { timeout: 5000, interval: 100 },
        )
        .toBe(10);
    } finally {
      await stop();
      env.EXPIRY_INTERVAL_MS = previous;
    }
  });
  it.each(['product', 'catalog', 'cart', 'dashboard'])(
    'releases due stock on %s reads without a worker',
    async (view) => {
      const { product, order, cart } = await reserved();
      await makeDue(order.id);
      const paths = {
        product: `/api/products/${product.id}`,
        catalog: '/api/products',
        cart: `/api/carts/${cart.id}`,
        dashboard: '/api/dashboard',
      };
      const response = await api.get(paths[view]);
      expect(response.status).toBe(200);
      const stock =
        view === 'product'
          ? response.body.data.stock
          : view === 'catalog'
            ? response.body.data[0].stock
            : view === 'cart'
              ? response.body.data.items[0].product.stock
              : response.body.data.availableStock;
      expect(stock).toBe(10);
      expect(
        (await db.order.findUnique({ where: { id: order.id } })).status,
      ).toBe('EXPIRED');
    },
  );
  it('concurrent new checkouts reclaim expired stock exactly once while payment and cleanup race', async () => {
    const { product, order } = await reserved(1, 1);
    const carts = await Promise.all(
      Array.from({ length: 5 }, () => cartFor(product.id)),
    );
    await makeDue(order.id);
    const [results] = await Promise.all([
      Promise.all(
        carts.map((cart) => api.post(`/api/carts/${cart.id}/checkout`)),
      ),
      pay(order.id),
      expireBatch(),
      api.get(`/api/products/${product.id}`),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(
      results.filter(
        (r) => r.status === 409 && r.body.error.code === 'INSUFFICIENT_STOCK',
      ),
    ).toHaveLength(4);
    expect(
      (await db.product.findUnique({ where: { id: product.id } })).stock,
    ).toBe(0);
    expect(await db.payment.count()).toBe(0);
    expect(await db.reservation.count({ where: { status: 'ACTIVE' } })).toBe(1);
  });
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
