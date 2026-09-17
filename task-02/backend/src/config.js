import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
  JWT_SECRET: z.string().min(32),
  FRONTEND_URL: z.url(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  RESERVATION_TTL_MINUTES: z.coerce.number().positive().max(60).default(10),
  CLEANUP_INTERVAL_SECONDS: z.coerce.number().int().min(1).default(30),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success)
  throw new Error(
    `Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
  );
export const config = parsed.data;
