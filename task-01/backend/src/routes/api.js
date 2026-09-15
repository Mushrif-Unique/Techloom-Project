import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/api.js';
import { adminOnly } from '../middleware/http.js';
import { env } from '../config/env.js';
export const router = Router();
const mutations = rateLimit({
  windowMs: 60000,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again shortly.',
    },
  },
});
router.get('/dashboard', controller.dashboard);
router.get('/products', controller.productList);
router.get('/products/:id', controller.productGet);
router.post('/products', mutations, adminOnly, controller.productCreate);
router.patch('/products/:id', mutations, adminOnly, controller.productUpdate);
router.delete('/products/:id', mutations, adminOnly, controller.productDelete);
router.post('/carts', mutations, controller.cartCreate);
router.get('/carts/:id', controller.cartGet);
router.post('/carts/:id/items', mutations, controller.itemAdd);
router.patch('/carts/:id/items/:itemId', mutations, controller.itemUpdate);
router.delete('/carts/:id/items/:itemId', mutations, controller.itemRemove);
router.post('/carts/:id/checkout', mutations, controller.cartCheckout);
router.get('/orders', controller.orderList);
router.get('/orders/:id', controller.orderGet);
router.post('/orders/:id/pay', mutations, controller.orderPay);
router.post('/orders/:id/cancel', mutations, controller.orderCancel);
