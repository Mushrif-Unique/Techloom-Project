import 'dotenv/config';
process.env.NODE_ENV = 'test';
process.env.PORT ||= '4000';
process.env.FRONTEND_URL ||= 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_MAX = '10000';
if (process.env.TEST_DATABASE_URL)
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ||=
  'postgresql://placeholder:placeholder@localhost:5432/pos_test';
