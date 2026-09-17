import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { db } from './db.js';
import { authenticate } from './middleware/auth.js';
import * as v from './validators.js';
import * as auth from './services/auth.js';
import * as products from './services/products.js';
import * as cart from './services/cart.js';
import * as checkout from './services/checkout.js';
import * as payments from './services/payments.js';
import * as orders from './services/orders.js';
export const app = express();
app.set('trust proxy', config.NODE_ENV === 'production' ? 1 : false);
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  }),
);
app.use(express.json({ limit: '16kb' }));
const rateResponse = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
};
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: config.NODE_ENV === 'test' ? 10000 : 180,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: rateResponse,
  }),
);
const authLimit = rateLimit({
  windowMs: 900000,
  limit: config.NODE_ENV === 'test' ? 10000 : 25,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateResponse,
});
const endpoint =
  (fn, status = 200) =>
  async (req, res) =>
    res.status(status).json({ success: true, data: await fn(req) });
const param = (req) => v.id.parse(req.params.id);
const key = (req) => v.key.parse(req.get('Idempotency-Key'));
app.get(
  '/api/health',
  endpoint(async () => {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }),
);
app.post(
  '/api/auth/register',
  authLimit,
  endpoint((req) => auth.register(v.registration.parse(req.body)), 201),
);
app.post(
  '/api/auth/login',
  authLimit,
  endpoint((req) => auth.login(v.login.parse(req.body))),
);
app.get(
  '/api/auth/me',
  authenticate,
  endpoint((req) => auth.me(req.userId)),
);
app.get(
  '/api/products',
  endpoint((req) => products.listProducts(v.productQuery.parse(req.query))),
);
app.get(
  '/api/products/:id',
  endpoint((req) => products.getProduct(param(req))),
);
app.use(['/api/cart', '/api/checkout', '/api/payments', '/api/orders'], authenticate);
app.get(
  '/api/cart',
  endpoint((req) => cart.getCart(req.userId)),
);
app.post(
  '/api/cart/items',
  endpoint((req) => cart.editCart(req.userId, v.addItem.parse(req.body)), 201),
);
app.patch(
  '/api/cart/items/:id',
  endpoint((req) => cart.editCart(req.userId, v.updateItem.parse(req.body), param(req))),
);
app.delete(
  '/api/cart/items/:id',
  endpoint((req) => cart.editCart(req.userId, {}, param(req), true)),
);
app.post(
  '/api/checkout',
  endpoint((req) => {
    v.empty.parse(req.body);
    return checkout.createCheckout(req.userId, key(req));
  }, 201),
);
app.get(
  '/api/checkout/:id',
  endpoint((req) => checkout.getCheckout(req.userId, param(req))),
);
app.post(
  '/api/checkout/:id/cancel',
  endpoint((req) => {
    v.empty.parse(req.body);
    return checkout.cancelCheckout(req.userId, param(req));
  }),
);
app.post(
  '/api/payments/:id/pay',
  endpoint((req) =>
    payments.pay(req.userId, param(req), key(req), v.payment.parse(req.body).cardNumber),
  ),
);
app.post(
  '/api/payments/:id/reconcile',
  endpoint((req) => {
    v.empty.parse(req.body);
    return payments.reconcile(req.userId, param(req));
  }),
);
app.get(
  '/api/orders',
  endpoint((req) => orders.listOrders(req.userId)),
);
app.get(
  '/api/orders/:id',
  endpoint((req) => orders.getOrder(req.userId, param(req))),
);
app.post(
  '/api/orders/:id/cancel',
  endpoint((req) =>
    orders.cancelOrder(req.userId, param(req), v.cancellation.parse(req.body).reason),
  ),
);
app.use((req, res) =>
  res
    .status(404)
    .json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }),
);
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.status ?? 500;
  let code = err.code ?? 'INTERNAL_ERROR';
  let message = err.message;
  if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = err.issues.map((i) => `${i.path.join('.') || 'Request'}: ${i.message}`).join(' ');
  } else if (err.code === 'P2002') {
    status = 409;
    code = 'ALREADY_EXISTS';
    message = 'That account or request already exists.';
  } else if (err.code === 'P2025') {
    status = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found.';
  } else if (
    err.code === 'P2034' ||
    (err.code === 'P2010' && ['40001', '40P01'].includes(err.meta?.code))
  ) {
    status = 409;
    code = 'BUSY';
    message = 'Inventory is busy. Please retry your request.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request must contain valid JSON.';
  }
  if (status >= 500) {
    console.error(JSON.stringify({ event: 'request.error', code: err.code ?? err.name }));
    code = 'INTERNAL_ERROR';
    message = 'Something went wrong. Please try again.';
  }
  res.status(status).json({ success: false, error: { code, message } });
});
