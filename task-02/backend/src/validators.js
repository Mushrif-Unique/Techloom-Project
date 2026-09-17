import { z } from 'zod';
export const id = z.uuid();
export const key = z
  .string()
  .min(16)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const quantity = z.number().int().min(1).max(99);
export const registration = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(10)
      .max(72)
      .refine((v) => Buffer.byteLength(v) <= 72, 'Password must be at most 72 bytes.'),
  })
  .strict();
export const login = registration.pick({ email: true, password: true });
export const addItem = z.object({ productId: id, quantity }).strict();
export const updateItem = z.object({ quantity }).strict();
export const empty = z.object({}).strict();
export const cancellation = z
  .object({ reason: z.string().trim().min(3).max(300).default('Customer requested cancellation') })
  .strict();
export const payment = z
  .object({
    cardNumber: z
      .string()
      .transform((v) => v.replace(/\s/g, ''))
      .pipe(
        z.enum(['4242424242424242', '4000000000000002', '4000000000009995', '4000000000009987']),
      ),
  })
  .strict();
export const productQuery = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: z.string().max(60).optional(),
    minPrice: z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/)
      .optional(),
    maxPrice: z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/)
      .optional(),
    available: z.enum(['true', 'false']).optional(),
    sort: z.enum(['featured', 'price_asc', 'price_desc', 'name']).default('featured'),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict()
  .refine(
    (q) => !q.minPrice || !q.maxPrice || Number(q.minPrice) <= Number(q.maxPrice),
    'Minimum price must not exceed maximum price.',
  );
