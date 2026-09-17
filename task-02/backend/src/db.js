import { PrismaClient, Prisma } from '@prisma/client';
export const db = new PrismaClient();
export { Prisma };
// Retry the entire database-only operation, never a remote side effect.
export async function transaction(fn) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: 'Serializable',
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      const retryable =
        ['P2034', 'P2002'].includes(error.code) ||
        (error.code === 'P2010' && ['40001', '40P01'].includes(error.meta?.code));
      if (!retryable || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1) + Math.random() * 20));
    }
  }
}
