import { z } from 'zod';
export const id = z.uuid();
export const quantity = z.number().int().min(1).max(1000);
export const productInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).nullable().optional(),
    price: z.number().int().min(0).max(100000000),
    stock: z.number().int().min(0).max(1000000),
    isActive: z.boolean().optional(),
  })
  .strict();
export const productPatch = productInput
  .partial()
  .extend({ expectedVersion: z.number().int().min(0).optional() })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'expectedVersion'),
    'Provide at least one field.',
  )
  .refine(
    (value) => value.stock === undefined || value.expectedVersion !== undefined,
    'Stock edits require expectedVersion from the current product.',
  );
export const addItemInput = z.object({ productId: id, quantity }).strict();
export const updateItemInput = z.object({ quantity }).strict();
export const paymentInput = z
  .object({ outcome: z.enum(['success', 'failure', 'timeout']) })
  .strict();
export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
