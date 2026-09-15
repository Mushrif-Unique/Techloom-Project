import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  api,
  db,
  databaseSuite,
  product,
  cartFor,
  reserved,
  pay,
  makeDue,
} from '../helpers.js';
import { expireBatch } from '../../src/jobs/expiration.js';
databaseSuite();
describe('product and cart API', () => {
  it('creates, lists, updates and deactivates products', async () => {
    const p = await product();
    expect((await api.get('/api/products')).body.data).toHaveLength(1);
    expect((await api.get(`/api/products/${p.id}`)).body.data.stock).toBe(10);
    expect(
      (
        await api.patch(`/api/products/${p.id}`).send({
          name: 'Changed',
          price: 100,
          stock: 7,
          expectedVersion: p.version,
        })
      ).body.data.name,
    ).toBe('Changed');
    expect((await api.delete(`/api/products/${p.id}`)).body.data.isActive).toBe(
      false,
    );
    expect(await db.product.count()).toBe(1);
  });
  it.each([{ price: -1 }, { stock: -1 }, { price: 1.1 }, { name: '  ' }])(
    'rejects invalid product %j',
    async (invalid) => {
      expect(
        (
          await api
            .post('/api/products')
            .send({ name: 'A', stock: 5, price: 100, ...invalid })
        ).status,
      ).toBe(422);
    },
  );
  it('adds, increments, changes and removes cart items without reserving inventory', async () => {
    const p = await product();
    const cart = await cartFor(p.id, 2);
    await api
      .post(`/api/carts/${cart.id}/items`)
      .send({ productId: p.id, quantity: 1 });
    let response = await api.get(`/api/carts/${cart.id}`);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.totalAmount).toBe(37500);
    const itemId = response.body.data.items[0].id;
    response = await api
      .patch(`/api/carts/${cart.id}/items/${itemId}`)
      .send({ quantity: 4 });
    expect(response.body.data.totalAmount).toBe(50000);
    for (const quantity of [0, -1, 1.2, '2'])
      expect(
        (
          await api
            .patch(`/api/carts/${cart.id}/items/${itemId}`)
            .send({ quantity })
        ).status,
      ).toBe(422);
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      10,
    );
    expect(
      (await api.delete(`/api/carts/${cart.id}/items/${itemId}`)).body.data
        .items,
    ).toHaveLength(0);
  });
  it('returns safe validation, 404 and malformed JSON responses', async () => {
    expect((await api.get('/api/products/invalid')).status).toBe(422);
    expect((await api.get(`/api/products/${randomUUID()}`)).status).toBe(404);
    expect((await api.get('/api/missing')).status).toBe(404);
    expect(
      (
        await api
          .post('/api/products')
          .set('Content-Type', 'application/json')
          .send('{')
      ).status,
    ).toBe(400);
    expect(
      (await api.get('/api/health')).headers['x-powered-by'],
    ).toBeUndefined();
    expect((await api.get('/api/health')).body.data.database).toBe('connected');
  });
});
describe('checkout integrity', () => {
  it('reserves with immutable price snapshots and exactly five-minute expiry', async () => {
    const { product: p, order } = await reserved();
    expect(order.status).toBe('RESERVED');
    expect(order.totalAmount).toBe(25000);
    expect(
      new Date(order.reservations[0].expiresAt) -
        new Date(order.reservations[0].createdAt),
    ).toBe(300000);
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      8,
    );
    await api.patch(`/api/products/${p.id}`).send({ price: 9900 });
    await api.delete(`/api/products/${p.id}`);
    const historic = (await api.get(`/api/orders/${order.id}`)).body.data;
    expect(historic.items[0].unitPrice).toBe(12500);
    expect(historic.totalAmount).toBe(25000);
  });
  it('rejects an empty cart', async () => {
    const cart = (await api.post('/api/carts')).body.data;
    expect(
      (await api.post(`/api/carts/${cart.id}/checkout`)).body.error.code,
    ).toBe('EMPTY_CART');
  });
  it('rolls back all products when one has insufficient stock', async () => {
    const a = await product(10);
    const b = await product(0);
    const cart = await cartFor(a.id, 2);
    await api
      .post(`/api/carts/${cart.id}/items`)
      .send({ productId: b.id, quantity: 1 });
    expect(
      (await api.post(`/api/carts/${cart.id}/checkout`)).body.error.code,
    ).toBe('INSUFFICIENT_STOCK');
    expect((await db.product.findUnique({ where: { id: a.id } })).stock).toBe(
      10,
    );
    expect(await db.order.count()).toBe(0);
    expect(await db.reservation.count()).toBe(0);
  });
  it('rolls back stock when a real database error interrupts order insertion', async () => {
    const p = await product();
    const cart = await cartFor(p.id);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION test_reject_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected test failure'; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER test_reject_order BEFORE INSERT ON "Order" FOR EACH ROW EXECUTE FUNCTION test_reject_order()',
    );
    try {
      expect((await api.post(`/api/carts/${cart.id}/checkout`)).status).toBe(
        500,
      );
      expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
        10,
      );
      expect(await db.order.count()).toBe(0);
      expect(await db.reservation.count()).toBe(0);
      expect(
        (await db.cart.findUnique({ where: { id: cart.id } })).status,
      ).toBe('ACTIVE');
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER test_reject_order ON "Order"');
      await db.$executeRawUnsafe('DROP FUNCTION test_reject_order()');
    }
  });
  it('database rejects negative stock independently of the API', async () => {
    const p = await product();
    await expect(
      db.product.update({ where: { id: p.id }, data: { stock: -1 } }),
    ).rejects.toThrow();
  });
});
describe('payments, expiration and cancellation', () => {
  it.each([
    ['success', 'PAID', 'CONSUMED', 8],
    ['failure', 'FAILED', 'RELEASED', 10],
    ['timeout', 'EXPIRED', 'EXPIRED', 10],
  ])('handles %s', async (outcome, status, reservation, stock) => {
    const { product: p, order } = await reserved();
    const key = randomUUID();
    const response = await pay(order.id, outcome, key);
    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe(status);
    expect(response.body.data.order.reservations[0].status).toBe(reservation);
    expect((await pay(order.id, outcome, key)).body.data.replayed).toBe(true);
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      stock,
    );
    expect(await db.payment.count()).toBe(1);
    expect((await pay(order.id, 'success')).status).toBe(409);
  });
  it('rejects missing keys and changed payloads with the same key', async () => {
    const { order } = await reserved();
    expect(
      (
        await api
          .post(`/api/orders/${order.id}/pay`)
          .send({ outcome: 'success' })
      ).status,
    ).toBe(422);
    const key = randomUUID();
    await pay(order.id, 'failure', key);
    expect((await pay(order.id, 'success', key)).body.error.code).toBe(
      'IDEMPOTENCY_KEY_REUSED',
    );
  });
  it('lazy expiration commits before rejecting payment and cannot release twice', async () => {
    const { product: p, order } = await reserved();
    await makeDue(order.id);
    expect((await pay(order.id)).body.error.code).toBe('RESERVATION_EXPIRED');
    expect(await expireBatch()).toBe(0);
    expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
      10,
    );
    expect(
      (await db.order.findUnique({ where: { id: order.id } })).status,
    ).toBe('EXPIRED');
    expect(await db.payment.count()).toBe(0);
  });
  it('worker and lazy GET each expire due reservations', async () => {
    const first = await reserved();
    await makeDue(first.order.id);
    expect(await expireBatch()).toBe(1);
    expect(await expireBatch()).toBe(0);
    const second = await reserved();
    await makeDue(second.order.id);
    expect(
      (await api.get(`/api/orders/${second.order.id}`)).body.data.status,
    ).toBe('EXPIRED');
  });
  it.each(['RESERVED', 'PAID'])(
    'cancels %s and restores exactly once',
    async (state) => {
      const { product: p, order } = await reserved();
      if (state === 'PAID') await pay(order.id);
      for (let n = 0; n < 3; n++)
        expect(
          (await api.post(`/api/orders/${order.id}/cancel`)).body.data.status,
        ).toBe('CANCELLED');
      expect((await db.product.findUnique({ where: { id: p.id } })).stock).toBe(
        10,
      );
      expect((await pay(order.id)).status).toBe(409);
    },
  );
  it.each(['failure', 'timeout'])(
    'rejects cancellation after %s',
    async (outcome) => {
      const { order } = await reserved();
      await pay(order.id, outcome);
      expect(
        (await api.post(`/api/orders/${order.id}/cancel`)).body.error.code,
      ).toBe('INVALID_ORDER_TRANSITION');
    },
  );
});
