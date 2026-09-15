import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
export function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
export function adminOnly(req, _res, next) {
  if (!env.ADMIN_API_KEY && env.NODE_ENV !== 'production') return next();
  const supplied = Buffer.from(req.get('X-Admin-Key') ?? '');
  const expected = Buffer.from(env.ADMIN_API_KEY);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new AppError(
      'UNAUTHORIZED',
      'A valid staff access key is required.',
      401,
    );
  }
  next();
}
export function errorHandler(error, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';
  if (error instanceof ZodError) {
    status = 422;
    code = 'INVALID_INPUT';
    message = error.issues
      .map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`)
      .join('; ');
  } else if (error instanceof AppError) {
    ({ status, code, message } = error);
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body must be valid JSON.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
  } else if (error.code === 'P2002') {
    status = 409;
    code = 'DUPLICATE_REQUEST';
    message = 'This operation has already been recorded.';
  } else if (['P2034', 'P2028', 'P2024'].includes(error.code)) {
    status = 503;
    code = 'DATABASE_BUSY';
    message = 'The database is busy. Please retry your request.';
  }
  if (status >= 500)
    logger.error(
      {
        event: 'unexpected_error',
        requestId: req.requestId,
        code: error.code,
        ...(env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
      },
      'Request failed',
    );
  res.status(status).json({
    success: false,
    error: { code, message },
    requestId: req.requestId,
  });
}
