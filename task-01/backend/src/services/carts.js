import { db } from '../config/db.js';
import { transaction, lockCart } from '../repositories/transactions.js';
import { AppError, requireValue } from '../utils/errors.js';
export const createCart = () => db.cart.create({ data: {} });
async function cartView(tx, id) {
  const cart = requireValue(
    await tx.cart.findUnique({
      where: { id },
      include: {
        items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
      },
    }),
    'CART_NOT_FOUND',
    'Cart not found.',
  );
  const items = cart.items.map((item) => ({
    ...item,
    subtotal: item.quantity * item.product.price,
  }));
  return {
    ...cart,
    items,
    totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
  };
}
export const getCart = (id) => cartView(db, id);
export const changeCart = (id, action, data) =>
  transaction(async (tx) => {
    const cart = await lockCart(tx, id);
    if (cart.status !== 'ACTIVE')
      throw new AppError(
        'CART_ALREADY_CHECKED_OUT',
        'This cart has already been checked out.',
      );
    if (action === 'add') {
      const product = requireValue(
        await tx.product.findUnique({ where: { id: data.productId } }),
        'PRODUCT_NOT_FOUND',
        'Product not found.',
      );
      if (!product.isActive)
        throw new AppError(
          'PRODUCT_INACTIVE',
          'This product is no longer available.',
        );
      const existing = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: id, productId: data.productId } },
      });
      if ((existing?.quantity ?? 0) + data.quantity > 1000)
        throw new AppError('INVALID_INPUT', 'Maximum quantity is 1,000.', 422);
      if (
        !existing &&
        (await tx.cartItem.count({ where: { cartId: id } })) >= 100
      )
        throw new AppError(
          'INVALID_INPUT',
          'A cart supports up to 100 products.',
          422,
        );
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: id, productId: data.productId } },
        create: { cartId: id, ...data },
        update: { quantity: { increment: data.quantity } },
      });
    } else {
      requireValue(
        await tx.cartItem.findFirst({ where: { id: data.itemId, cartId: id } }),
        'CART_ITEM_NOT_FOUND',
        'Cart item not found.',
      );
      if (action === 'remove')
        await tx.cartItem.delete({ where: { id: data.itemId } });
      else
        await tx.cartItem.update({
          where: { id: data.itemId },
          data: { quantity: data.quantity },
        });
    }
    return cartView(tx, id);
  });
