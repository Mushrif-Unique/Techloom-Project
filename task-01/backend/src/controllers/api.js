import * as products from '../services/products.js';
import * as carts from '../services/carts.js';
import * as orders from '../services/orders.js';
import { checkout } from '../services/checkout.js';
import { payOrder } from '../services/payments.js';
import * as schemas from '../validators/schemas.js';
import { AppError } from '../utils/errors.js';
const send = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
const param = (req, name = 'id') => schemas.id.parse(req.params[name]);
export const productList = async (_req, res) =>
  send(res, await products.listProducts());
export const productGet = async (req, res) =>
  send(res, await products.getProduct(param(req)));
export const productCreate = async (req, res) =>
  send(
    res,
    await products.createProduct(schemas.productInput.parse(req.body)),
    201,
  );
export const productUpdate = async (req, res) =>
  send(
    res,
    await products.updateProduct(
      param(req),
      schemas.productPatch.parse(req.body),
    ),
  );
export const productDelete = async (req, res) =>
  send(res, await products.deactivateProduct(param(req)));
export const cartCreate = async (_req, res) =>
  send(res, await carts.createCart(), 201);
export const cartGet = async (req, res) =>
  send(res, await carts.getCart(param(req)));
export const itemAdd = async (req, res) =>
  send(
    res,
    await carts.changeCart(
      param(req),
      'add',
      schemas.addItemInput.parse(req.body),
    ),
  );
export const itemUpdate = async (req, res) =>
  send(
    res,
    await carts.changeCart(param(req), 'update', {
      ...schemas.updateItemInput.parse(req.body),
      itemId: param(req, 'itemId'),
    }),
  );
export const itemRemove = async (req, res) =>
  send(
    res,
    await carts.changeCart(param(req), 'remove', {
      itemId: param(req, 'itemId'),
    }),
  );
export const cartCheckout = async (req, res) =>
  send(res, await checkout(param(req)));
export const orderList = async (req, res) =>
  send(res, await orders.listOrders(schemas.pagination.parse(req.query)));
export const orderGet = async (req, res) =>
  send(res, await orders.getOrder(param(req)));
export const orderCancel = async (req, res) => {
  const result = await orders.cancelOrder(param(req));
  if (result.expired)
    throw new AppError(
      'RESERVATION_EXPIRED',
      'The reservation expired and inventory was restored.',
    );
  send(res, result);
};
export const orderPay = async (req, res) => {
  const { outcome } = schemas.paymentInput.parse(req.body);
  const result = await payOrder(
    param(req),
    outcome,
    schemas.id.parse(req.get('Idempotency-Key')),
  );
  // Expiration is committed before returning a conflict; throwing inside the transaction would undo it.
  if (result.expired)
    throw new AppError(
      'RESERVATION_EXPIRED',
      'The reservation expired and inventory was restored.',
    );
  send(res, result);
};
export const dashboard = async (_req, res) =>
  send(res, await orders.dashboard());
