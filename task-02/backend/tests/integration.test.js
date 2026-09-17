import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { db } from '../src/db.js';
import { transition } from '../src/lib/states.js';
let a, b, p;
const success = '4242424242424242',
  failed = '4000000000000002',
  timeout = '4000000000009995',
  paidOrderFailure = '4000000000009987';
const call = (method, path, token = a) =>
  request(app)[method](`/api${path}`).set('Authorization', `Bearer ${token}`);
const add = (quantity = 1, token = a, productId = p.id) =>
  call('post', '/cart/items', token).send({ productId, quantity });
const checkout = (token = a, key = randomUUID()) =>
  call('post', '/checkout', token).set('Idempotency-Key', key).send({});
const pay = (id, cardNumber = success, key = randomUUID(), token = a) =>
  call('post', `/payments/${id}/pay`, token).set('Idempotency-Key', key).send({ cardNumber });
async function reserved(token = a) {
  await add(1, token);
  const result = await checkout(token);
  expect(result.status).toBe(201);
  return result.body.data;
}
async function purchased() {
  const c = await reserved();
  const result = await pay(c.id);
  expect(result.status).toBe(200);
  return result.body.data.order;
}
beforeAll(async () => {
  await db.$connect();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE "OrderStatusHistory", "Refund", "OrderItem", "Order", "Payment", "StockReservation", "CheckoutSession", "CartItem", "Cart", "User", "Product" CASCADE',
  );
  const register = async (email) => {
    const r = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Customer', email, password: 'a-valid-test-password' });
    expect(r.status).toBe(201);
    return r.body.data.token;
  };
  a = await register('a@example.test');
  b = await register('b@example.test');
  p = await db.product.create({
    data: {
      name: 'Studio Keyboard',
      description: 'Quiet wireless keyboard for your desk',
      category: 'Electronics',
      price: '79.95',
      imageUrl: '/images/keyboard.svg',
      stockQuantity: 5,
    },
  });
});
describe('Authentication and validation', () => {
  it('registers with a bcrypt hash, signs in, and never exposes the hash', async () => {
    const user = await db.user.findUnique({ where: { email: 'a@example.test' } });
    expect(user.passwordHash).toMatch(/^\$2/);
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: 'A@example.test', password: 'a-valid-test-password' });
    expect(r.status).toBe(200);
    expect(r.body.data.user.passwordHash).toBeUndefined();
    expect((await call('get', '/auth/me')).body.data.email).toBe('a@example.test');
  });
  it('rejects invalid credentials and duplicate accounts', async () => {
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'a@example.test', password: 'incorrect-password' })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/auth/register')
          .send({ name: 'Other', email: 'a@example.test', password: 'a-valid-test-password' })
      ).status,
    ).toBe(409);
  });
  it('blocks missing or invalid authentication', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
    expect((await call('get', '/orders', 'bad')).status).toBe(401);
  });
  it('rejects malformed IDs, unknown fields and invalid JSON', async () => {
    expect((await call('get', '/products/not-an-id')).status).toBe(422);
    expect(
      (await call('post', '/cart/items').send({ productId: p.id, quantity: 1, price: 1 })).status,
    ).toBe(422);
    expect(
      (await call('post', '/checkout').set('Content-Type', 'application/json').send('{broken'))
        .status,
    ).toBe(400);
  });
  it('sets security headers and restricts the allowed CORS origin', async () => {
    const r = await request(app).get('/api/products').set('Origin', 'https://untrusted.example');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
describe('Product discovery and cart', () => {
  it('combines case insensitive search, category, price, and availability', async () => {
    const r = await request(app).get(
      '/api/products?search=WIRELESS&category=Electronics&minPrice=70&maxPrice=80&available=true',
    );
    expect(r.body.data.total).toBe(1);
    for (const query of [
      'search=unmatched',
      'category=Home',
      'minPrice=80',
      'maxPrice=70',
      'available=false',
    ])
      expect((await request(app).get(`/api/products?${query}`)).body.data.total).toBe(0);
  });
  it('uses available inventory rather than physical stock and hides inactive products', async () => {
    await db.product.update({ where: { id: p.id }, data: { reservedQuantity: 5 } });
    expect((await request(app).get('/api/products?available=true')).body.data.total).toBe(0);
    expect((await request(app).get('/api/products?available=false')).body.data.total).toBe(1);
    await db.product.update({ where: { id: p.id }, data: { active: false } });
    expect((await request(app).get(`/api/products/${p.id}`)).status).toBe(404);
    expect((await add()).status).toBe(404);
  });
  it('validates filters and escapes wildcard searches literally', async () => {
    expect((await request(app).get('/api/products?minPrice=90&maxPrice=2')).status).toBe(422);
    expect((await request(app).get('/api/products?search=%25')).body.data.total).toBe(0);
  });
  it('adds, increments, updates, and removes items with exact server totals', async () => {
    let r = await add(2);
    expect(r.body.data.subtotal).toBe('159.9');
    r = await add();
    expect(r.body.data.itemCount).toBe(3);
    const id = r.body.data.items[0].id;
    r = await call('patch', `/cart/items/${id}`).send({ quantity: 4 });
    expect(r.body.data.subtotal).toBe('319.8');
    expect((await call('delete', `/cart/items/${id}`)).body.data.items).toHaveLength(0);
  });
  it('rejects zero, negative, fractional, excessive quantities and another user cart item', async () => {
    for (const quantity of [0, -1, 1.5, 100]) expect((await add(quantity)).status).toBe(422);
    expect((await add(6)).status).toBe(409);
    const r = await add();
    expect(
      (await call('patch', `/cart/items/${r.body.data.items[0].id}`, b).send({ quantity: 2 }))
        .status,
    ).toBe(404);
  });
});
describe('Checkout, inventory, and concurrency', () => {
  it('reserves stock atomically using server prices and a deadline', async () => {
    const c = await reserved();
    expect(c.totalAmount).toBe('79.95');
    expect(c.reservations[0].status).toBe('ACTIVE');
    expect(new Date(c.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const stock = await db.product.findUnique({ where: { id: p.id } });
    expect(stock.stockQuantity).toBe(5);
    expect(stock.reservedQuantity).toBe(1);
  });
  it('rejects an empty cart and missing idempotency key', async () => {
    expect((await checkout()).status).toBe(409);
    expect((await call('post', '/checkout').send({})).status).toBe(422);
  });
  it('replays checkout and reuses active checkout even with different keys', async () => {
    await add();
    const key = randomUUID();
    const [x, y] = await Promise.all([checkout(a, key), checkout(a, key)]);
    expect(x.body.data.id).toBe(y.body.data.id);
    expect((await checkout()).body.data.id).toBe(x.body.data.id);
    expect(await db.stockReservation.count()).toBe(1);
  });
  it('fails when stock changed after adding to cart', async () => {
    await add(5);
    await db.product.update({ where: { id: p.id }, data: { stockQuantity: 1 } });
    expect((await checkout()).status).toBe(409);
    expect(await db.stockReservation.count()).toBe(0);
  });
  it('only one of two customers can reserve the final item', async () => {
    await db.product.update({ where: { id: p.id }, data: { stockQuantity: 1 } });
    await add(1, a);
    await add(1, b);
    const results = await Promise.all([checkout(a), checkout(b)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.stockReservation.count()).toBe(1);
    expect((await db.product.findUnique({ where: { id: p.id } })).reservedQuantity).toBe(1);
  });
  it('rolls back all reservations when one item has insufficient stock', async () => {
    await add();
    const extra = await db.product.create({
      data: {
        name: 'Other',
        category: 'Home',
        description: 'Other item',
        price: '20.00',
        stockQuantity: 1,
        imageUrl: '/images/vase.svg',
      },
    });
    await add(1, a, extra.id);
    await db.product.update({ where: { id: extra.id }, data: { stockQuantity: 0 } });
    expect((await checkout()).status).toBe(409);
    expect((await db.product.findUnique({ where: { id: p.id } })).reservedQuantity).toBe(0);
  });
  it('expires reservations on server operations and blocks late payment', async () => {
    const c = await reserved();
    await db.checkoutSession.update({ where: { id: c.id }, data: { expiresAt: new Date(0) } });
    expect((await pay(c.id)).status).toBe(409);
    expect((await db.product.findUnique({ where: { id: p.id } })).reservedQuantity).toBe(0);
    expect((await db.stockReservation.findFirst()).status).toBe('EXPIRED');
  });
  it('cancels unpaid checkout idempotently without refunding', async () => {
    const c = await reserved();
    const results = await Promise.all([
      call('post', `/checkout/${c.id}/cancel`).send({}),
      call('post', `/checkout/${c.id}/cancel`).send({}),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await db.refund.count()).toBe(0);
    expect((await db.product.findUnique({ where: { id: p.id } })).reservedQuantity).toBe(0);
  });
  it('enforces ownership on checkout and payment reads/writes', async () => {
    const c = await reserved();
    expect((await call('get', `/checkout/${c.id}`, b)).status).toBe(404);
    expect((await pay(c.id, success, randomUUID(), b)).status).toBe(404);
    expect((await call('post', `/checkout/${c.id}/cancel`, b).send({})).status).toBe(404);
    expect((await call('post', `/payments/${c.id}/reconcile`, b).send({})).status).toBe(404);
  });
});
describe('Payments and order invariants', () => {
  it('success creates one order, consumes stock and clears purchased cart items', async () => {
    const order = await purchased();
    expect(order.status).toBe('CONFIRMED');
    expect(await db.order.count()).toBe(1);
    expect((await db.stockReservation.findFirst()).status).toBe('CONSUMED');
    expect((await db.product.findUnique({ where: { id: p.id } })).stockQuantity).toBe(4);
    expect((await call('get', '/cart')).body.data.items).toHaveLength(0);
  });
  it('preserves cart changes made after a checkout snapshot', async () => {
    const c = await reserved();
    const item = await db.cartItem.findFirst();
    await call('patch', `/cart/items/${item.id}`).send({ quantity: 2 });
    await pay(c.id);
    expect((await call('get', '/cart')).body.data.items[0].quantity).toBe(2);
  });
  it('concurrent requests with the same key create exactly one payment and order', async () => {
    const c = await reserved();
    const key = randomUUID();
    const responses = await Promise.all([
      pay(c.id, success, key),
      pay(c.id, success, key),
      pay(c.id, success, key),
    ]);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(new Set(responses.map((r) => r.body.data.order.id)).size).toBe(1);
    expect(await db.payment.count()).toBe(1);
    expect(await db.order.count()).toBe(1);
  });
  it('different keys cannot create two charges on one checkout', async () => {
    const c = await reserved();
    const results = await Promise.all([pay(c.id), pay(c.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db.order.count()).toBe(1);
    expect(await db.payment.count()).toBe(1);
  });
  it('rejects reuse of a payment key with a different request', async () => {
    const c = await reserved();
    const key = randomUUID();
    await pay(c.id, failed, key);
    expect((await pay(c.id, success, key)).status).toBe(409);
    const next = await checkout();
    expect((await pay(next.body.data.id, failed, key)).status).toBe(409);
  });
  it('declines release stock and require a fresh checkout', async () => {
    const c = await reserved();
    const r = await pay(c.id, failed);
    expect(r.body.data.payment.status).toBe('FAILED');
    expect(r.body.data.reservations[0].status).toBe('RELEASED');
    expect((await db.product.findUnique({ where: { id: p.id } })).reservedQuantity).toBe(0);
    expect(await db.order.count()).toBe(0);
    expect((await pay(c.id)).status).toBe(409);
    expect((await checkout()).body.data.id).not.toBe(c.id);
  });
  it('timeout retries replay the unresolved attempt; reconciliation releases stock', async () => {
    const c = await reserved();
    const key = randomUUID();
    expect((await pay(c.id, timeout, key)).body.data.payment.status).toBe('TIMEOUT');
    expect((await pay(c.id, timeout, key)).body.data.payment.status).toBe('TIMEOUT');
    expect((await pay(c.id, success)).status).toBe(409);
    expect((await db.product.findUnique({ where: { id: p.id } })).reservedQuantity).toBe(1);
    const r = await call('post', `/payments/${c.id}/reconcile`).send({});
    expect(r.body.data.payment.status).toBe('FAILED');
    expect((await db.product.findUnique({ where: { id: p.id } })).reservedQuantity).toBe(0);
    expect(await db.order.count()).toBe(0);
    expect(await db.payment.count()).toBe(1);
  });
  it('automatically reconciles abandoned timeouts at expiry', async () => {
    const c = await reserved();
    await pay(c.id, timeout);
    await db.checkoutSession.update({ where: { id: c.id }, data: { expiresAt: new Date(0) } });
    await request(app).get('/api/products');
    expect((await db.payment.findFirst()).status).toBe('FAILED');
    expect((await db.product.findUnique({ where: { id: p.id } })).reservedQuantity).toBe(0);
  });
  it('stores immutable purchase names and prices', async () => {
    const c = await reserved();
    await db.product.update({ where: { id: p.id }, data: { name: 'Changed', price: '1.00' } });
    const r = await pay(c.id);
    const order = await call('get', `/orders/${r.body.data.order.id}`);
    expect(order.body.data.items[0].productName).toBe('Studio Keyboard');
    expect(order.body.data.items[0].unitPrice).toBe('79.95');
  });
});
describe('Paid order failure and automatic refund', () => {
  it('records a successful charge then failed order, refunds the full trusted total and restores every SKU', async () => {
    const second = await db.product.create({
      data: {
        name: 'Cup',
        description: 'Test cup',
        category: 'Home',
        price: '10.05',
        imageUrl: '/images/mug.svg',
        stockQuantity: 8,
      },
    });
    await add(2);
    await add(3, a, second.id);
    const c = (await checkout()).body.data;
    const result = await pay(c.id, paidOrderFailure);
    expect(result.status).toBe(200);
    expect(result.body.data.status).toBe('COMPLETED');
    expect(result.body.data.payment).toMatchObject({
      status: 'SUCCESS',
      scenario: 'ORDER_FAILURE',
      amount: '190.05',
    });
    expect(result.body.data.payment.transactionReference).toMatch(/^mock_/);
    expect(result.body.data.order.status).toBe('REFUNDED');
    expect(result.body.data.reservations.every((r) => r.status === 'CONSUMED')).toBe(true);
    const order = (await call('get', `/orders/${result.body.data.order.id}`)).body.data;
    expect(order.refund).toMatchObject({
      amount: '190.05',
      status: 'SUCCESS',
      paymentId: result.body.data.payment.id,
    });
    expect(order.refund.reason).toContain('after successful payment');
    expect(order.refund.processedAt).toBeTruthy();
    expect(order.history.map((h) => h.status)).toEqual([
      'CONFIRMED',
      'FAILED',
      'REFUND_PENDING',
      'REFUNDED',
    ]);
    expect(order.history.map((h) => h.sequence)).toEqual([1, 2, 3, 4]);
    expect(order.history.every((h) => h.createdAt)).toBe(true);
    expect(await db.product.findUnique({ where: { id: p.id } })).toMatchObject({
      stockQuantity: 5,
      reservedQuantity: 0,
    });
    expect(await db.product.findUnique({ where: { id: second.id } })).toMatchObject({
      stockQuantity: 8,
      reservedQuantity: 0,
    });
    expect((await call('get', '/cart')).body.data.itemCount).toBe(0);
    expect((await call('get', '/orders')).body.data[0].status).toBe('REFUNDED');
  });
  it('concurrent retries create exactly one charge, order, refund and stock restoration', async () => {
    const c = await reserved();
    const key = randomUUID();
    const results = await Promise.all([
      pay(c.id, paidOrderFailure, key),
      pay(c.id, paidOrderFailure, key),
      pay(c.id, paidOrderFailure, key),
    ]);
    expect(results.every((r) => r.status === 200 && r.body.data.order.status === 'REFUNDED')).toBe(
      true,
    );
    expect(new Set(results.map((r) => r.body.data.order.id)).size).toBe(1);
    expect(await db.payment.count()).toBe(1);
    expect(await db.order.count()).toBe(1);
    expect(await db.refund.count()).toBe(1);
    expect(await db.orderStatusHistory.count()).toBe(4);
    expect(await db.product.findUnique({ where: { id: p.id } })).toMatchObject({
      stockQuantity: 5,
      reservedQuantity: 0,
    });
    expect((await pay(c.id, success, key)).status).toBe(409);
    expect((await pay(c.id, paidOrderFailure)).status).toBe(409);
  });
  it('cancellation of an automatically refunded order replays without a second refund', async () => {
    const c = await reserved();
    const order = (await pay(c.id, paidOrderFailure)).body.data.order;
    const results = await Promise.all([
      call('post', `/orders/${order.id}/cancel`).send({}),
      call('post', `/orders/${order.id}/cancel`).send({}),
    ]);
    expect(results.every((r) => r.status === 200 && r.body.data.status === 'REFUNDED')).toBe(true);
    expect(await db.refund.count()).toBe(1);
    expect(await db.orderStatusHistory.count()).toBe(4);
    expect((await db.product.findUnique({ where: { id: p.id } })).stockQuantity).toBe(5);
    expect(() => transition('order', 'REFUNDED', 'FAILED')).toThrow();
  });
  it('enforces ownership for the failure scenario and its refunded order', async () => {
    const c = await reserved();
    expect((await pay(c.id, paidOrderFailure, randomUUID(), b)).status).toBe(404);
    expect(await db.payment.count()).toBe(0);
    const order = (await pay(c.id, paidOrderFailure)).body.data.order;
    expect((await call('get', `/orders/${order.id}`, b)).status).toBe(404);
    expect((await call('post', `/orders/${order.id}/cancel`, b).send({})).status).toBe(404);
    expect((await call('get', '/orders', b)).body.data).toHaveLength(0);
  });
});
describe('Cancellation and refunds', () => {
  it('refunds trusted total, restores stock and records every status transition', async () => {
    const order = await purchased();
    const r = await call('post', `/orders/${order.id}/cancel`).send({ reason: 'Changed my mind' });
    expect(r.body.data.status).toBe('REFUNDED');
    expect(r.body.data.refund.amount).toBe('79.95');
    expect(r.body.data.refund.status).toBe('SUCCESS');
    expect(r.body.data.history.map((h) => h.status)).toEqual([
      'CONFIRMED',
      'CANCELLED',
      'REFUND_PENDING',
      'REFUNDED',
    ]);
    expect((await db.product.findUnique({ where: { id: p.id } })).stockQuantity).toBe(5);
  });
  it('concurrent duplicate cancellation restores stock and refunds exactly once', async () => {
    const order = await purchased();
    const cancel = () => call('post', `/orders/${order.id}/cancel`).send({});
    const result = await Promise.all([cancel(), cancel(), cancel()]);
    expect(result.every((r) => r.status === 200)).toBe(true);
    expect(await db.refund.count()).toBe(1);
    expect(await db.orderStatusHistory.count()).toBe(4);
    expect((await db.product.findUnique({ where: { id: p.id } })).stockQuantity).toBe(5);
  });
  it('users can see and cancel only their own orders', async () => {
    const order = await purchased();
    expect((await call('get', '/orders')).body.data).toHaveLength(1);
    expect((await call('get', '/orders', b)).body.data).toHaveLength(0);
    expect((await call('get', `/orders/${order.id}`, b)).status).toBe(404);
    expect((await call('post', `/orders/${order.id}/cancel`, b).send({})).status).toBe(404);
  });
  it('rejects client refund amount and invalid state transitions', async () => {
    const order = await purchased();
    expect((await call('post', `/orders/${order.id}/cancel`).send({ amount: 1000 })).status).toBe(
      422,
    );
    expect(() => transition('order', 'REFUNDED', 'CONFIRMED')).toThrow();
    expect(() => transition('reservation', 'CONSUMED', 'ACTIVE')).toThrow();
  });
  it('database constraints reject negative stock and duplicate orders', async () => {
    const order = await purchased();
    await expect(
      db.product.update({ where: { id: p.id }, data: { stockQuantity: -1 } }),
    ).rejects.toThrow();
    const existing = await db.order.findUnique({ where: { id: order.id } });
    await expect(
      db.order.create({
        data: {
          userId: existing.userId,
          checkoutSessionId: existing.checkoutSessionId,
          totalAmount: existing.totalAmount,
        },
      }),
    ).rejects.toThrow();
  });
});
