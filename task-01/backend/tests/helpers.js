import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, expect } from 'vitest';
import { app } from '../src/app.js';
import { db } from '../src/config/db.js';
export const api = request(app);
export { db };
export function databaseSuite() {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error(
        'Tests require TEST_DATABASE_URL pointing to a dedicated database ending in _test.',
      );
    await db.$connect();
  });
  beforeEach(async () => {
    await db.$transaction([
      db.payment.deleteMany(),
      db.reservation.deleteMany(),
      db.orderItem.deleteMany(),
      db.order.deleteMany(),
      db.cartItem.deleteMany(),
      db.cart.deleteMany(),
      db.product.deleteMany(),
    ]);
  });
  afterAll(() => db.$disconnect());
}
export async function product(stock = 10, price = 12500) {
  const response = await api
    .post('/api/products')
    .send({ name: 'Test Product', price, stock });
  expect(response.status).toBe(201);
  return response.body.data;
}
export async function cartFor(productId, quantity = 1) {
  const response = await api.post('/api/carts');
  expect(response.status).toBe(201);
  const cart = response.body.data;
  expect(
    (
      await api
        .post(`/api/carts/${cart.id}/items`)
        .send({ productId, quantity })
    ).status,
  ).toBe(200);
  return cart;
}
export async function reserved(stock = 10, quantity = 2) {
  const p = await product(stock);
  const c = await cartFor(p.id, quantity);
  const response = await api.post(`/api/carts/${c.id}/checkout`);
  expect(response.status).toBe(200);
  return { product: p, cart: c, order: response.body.data };
}
export const pay = (id, outcome = 'success', key = randomUUID()) =>
  api
    .post(`/api/orders/${id}/pay`)
    .set('Idempotency-Key', key)
    .send({ outcome });
export async function makeDue(orderId) {
  // Preserve the exact five-minute constraint while moving the test fixture into the past.
  await db.$executeRaw`UPDATE "Reservation" SET "createdAt" = statement_timestamp() - interval '6 minutes', "expiresAt" = statement_timestamp() - interval '1 minute' WHERE "orderId" = ${orderId}::uuid`;
}
