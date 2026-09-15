import { db } from '../config/db.js';
import { transaction, lockProducts } from '../repositories/transactions.js';
import { AppError, requireValue } from '../utils/errors.js';
export const listProducts = () =>
  db.product.findMany({ orderBy: { createdAt: 'asc' }, take: 1000 });
export const getProduct = async (id) =>
  requireValue(
    await db.product.findUnique({ where: { id } }),
    'PRODUCT_NOT_FOUND',
    'Product not found.',
  );
export const createProduct = (data) => db.product.create({ data });
export const updateProduct = (id, input) =>
  transaction(async (tx) => {
    const product = requireValue(
      (await lockProducts(tx, [id]))[0],
      'PRODUCT_NOT_FOUND',
      'Product not found.',
    );
    const { expectedVersion, ...data } = input;
    if (data.stock !== undefined && expectedVersion !== product.version)
      throw new AppError(
        'STALE_PRODUCT',
        'Inventory changed while you were editing. Close and reopen the editor to review current stock.',
      );
    return tx.product.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  });
export const deactivateProduct = (id) => updateProduct(id, { isActive: false });
