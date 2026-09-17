import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { config } from '../config.js';
import { assert } from '../lib/errors.js';
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });
const result = (user) => ({
  user: publicUser(user),
  token: jwt.sign({}, config.JWT_SECRET, {
    subject: user.id,
    expiresIn: '8h',
    issuer: 'atelier-api',
    audience: 'atelier-store',
  }),
});
export async function register(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await db.user.create({
    data: { name: input.name, email: input.email, passwordHash, cart: { create: {} } },
  });
  return result(user);
}
// A fixed cost hash avoids a fast path for unknown accounts. It is not a credential.
const dummyHash = await bcrypt.hash('not-an-account-password', 12);
export async function login(input) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);
  assert(user && valid, 401, 'INVALID_LOGIN', 'Email or password is incorrect.');
  return result(user);
}
export async function me(userId) {
  return publicUser(await db.user.findUniqueOrThrow({ where: { id: userId } }));
}
