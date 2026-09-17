import { db, Prisma, transaction } from '../db.js';
import { assert } from '../lib/errors.js';
import { cleanup } from './inventory.js';
const include = { items: { include: { product: true }, orderBy: { id: 'asc' } } };
export async function getCart(userId) {
  await cleanup();
  const cart = await db.cart.findUniqueOrThrow({ where: { userId }, include });
  return {
    ...cart,
    subtotal: cart.items.reduce(
      (sum, i) => sum.add(i.product.price.mul(i.quantity)),
      new Prisma.Decimal(0),
    ),
    itemCount: cart.items.reduce((n, i) => n + i.quantity, 0),
    items: cart.items.map((i) => ({
      ...i,
      availableQuantity: i.product.stockQuantity - i.product.reservedQuantity,
      lineTotal: i.product.price.mul(i.quantity),
    })),
  };
}
export async function editCart(userId, input, itemId, remove = false) {
  await cleanup();
  await transaction(async (tx) => {
    const cart = await tx.cart.findUniqueOrThrow({ where: { userId } });
    const existing = itemId
      ? await tx.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } })
      : await tx.cartItem.findUnique({
          where: { cartId_productId: { cartId: cart.id, productId: input.productId } },
        });
    if (itemId) assert(existing, 404, 'ITEM_NOT_FOUND', 'Cart item not found.');
    if (remove) {
      await tx.cartItem.delete({ where: { id: existing.id } });
      return;
    }
    const productId = existing?.productId ?? input.productId;
    const product = await tx.product.findUnique({ where: { id: productId } });
    assert(product?.active, 404, 'PRODUCT_NOT_FOUND', 'This product is not available.');
    const quantity = itemId ? input.quantity : (existing?.quantity ?? 0) + input.quantity;
    assert(
      quantity <= 99 && quantity <= product.stockQuantity - product.reservedQuantity,
      409,
      'INSUFFICIENT_STOCK',
      'There is not enough available stock for that quantity.',
    );
    await tx.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity },
    });
  });
  return getCart(userId);
}
