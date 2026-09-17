import { randomBytes } from 'node:crypto';
if (!process.env.TEST_DATABASE_URL)
  throw new Error(
    'Set TEST_DATABASE_URL to an isolated database ending in _test, or use npm run test:local. Tests delete all data in that database.',
  );
const url = new URL(process.env.TEST_DATABASE_URL);
if (!url.pathname.endsWith('_test'))
  throw new Error('Refusing to clear a database whose name does not end in _test.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET ||= randomBytes(48).toString('hex');
process.env.FRONTEND_URL ||= 'http://localhost:5173';
process.env.NODE_ENV = 'test';
