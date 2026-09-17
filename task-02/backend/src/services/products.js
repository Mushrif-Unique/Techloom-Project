import { db, Prisma } from '../db.js';
import { assert } from '../lib/errors.js';
import { cleanup } from './inventory.js';
export const presentProduct = (p) => ({
  ...p,
  availableQuantity: p.stockQuantity - p.reservedQuantity,
});
export async function listProducts(q) {
  await cleanup();
  const conditions = [Prisma.sql`active = true`];
  if (q.search) {
    const term = `%${q.search.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(Prisma.sql`(name ILIKE ${term} OR description ILIKE ${term})`);
  }
  if (q.category) conditions.push(Prisma.sql`category = ${q.category}`);
  if (q.minPrice) conditions.push(Prisma.sql`price >= ${new Prisma.Decimal(q.minPrice)}`);
  if (q.maxPrice) conditions.push(Prisma.sql`price <= ${new Prisma.Decimal(q.maxPrice)}`);
  if (q.available)
    conditions.push(
      q.available === 'true'
        ? Prisma.sql`"stockQuantity" > "reservedQuantity"`
        : Prisma.sql`"stockQuantity" = "reservedQuantity"`,
    );
  const order = {
    featured: Prisma.sql`"createdAt" DESC, id`,
    price_asc: Prisma.sql`price ASC, id`,
    price_desc: Prisma.sql`price DESC, id`,
    name: Prisma.sql`name ASC, id`,
  }[q.sort];
  const where = Prisma.join(conditions, ' AND ');
  const [items, count, categories] = await db.$transaction(
    [
      db.$queryRaw(
        Prisma.sql`SELECT * FROM "Product" WHERE ${where} ORDER BY ${order} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      ),
      db.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS total FROM "Product" WHERE ${where}`),
      db.product.findMany({
        where: { active: true },
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
    ],
    { isolationLevel: 'RepeatableRead' },
  );
  return {
    items: items.map(presentProduct),
    total: count[0].total,
    page: q.page,
    pages: Math.ceil(count[0].total / q.limit),
    categories: categories.map((p) => p.category),
  };
}
export async function getProduct(id) {
  await cleanup();
  const product = await db.product.findFirst({ where: { id, active: true } });
  assert(product, 404, 'PRODUCT_NOT_FOUND', 'This product is not available.');
  return presentProduct(product);
}
