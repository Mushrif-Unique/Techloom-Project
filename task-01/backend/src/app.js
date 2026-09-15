import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { db } from './config/db.js';
import { router } from './routes/api.js';
import { requestId, errorHandler } from './middleware/http.js';
import { AppError } from './utils/errors.js';
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
app.use(
  requestId,
  helmet(),
  cors({
    origin: env.FRONTEND_URL,
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Admin-Key'],
  }),
);
app.use(express.json({ limit: '16kb' }));
app.get('/api/health', async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ success: true, data: { status: 'ok', database: 'connected' } });
  } catch {
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Service is temporarily unavailable.',
      },
    });
  }
});
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: env.RATE_LIMIT_MAX * 4,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again shortly.',
      },
    },
  }),
  router,
);
app.use((_req, _res) => {
  throw new AppError('NOT_FOUND', 'Endpoint not found.', 404);
});
app.use(errorHandler);
