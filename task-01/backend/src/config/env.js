import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535),
  FRONTEND_URL: z.string().url(),
  EXPIRY_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(15000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  ADMIN_API_KEY: z.string().default(''),
  LOG_LEVEL: z
    .enum(['silent', 'error', 'warn', 'info', 'debug'])
    .default('info'),
});
export const env = schema.parse(process.env);
if (env.NODE_ENV === 'production' && env.ADMIN_API_KEY.length < 32) {
  throw new Error(
    'Production requires an ADMIN_API_KEY of at least 32 characters.',
  );
}
