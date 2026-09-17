import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
export function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new Error();
    const payload = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'atelier-api',
      audience: 'atelier-store',
    });
    req.userId = payload.sub;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Please sign in to continue.'));
  }
}
