import { describe, it, expect } from 'vitest';
import {
  transitions,
  assertTransition,
  RESERVATION_MS,
} from '../../src/constants/lifecycle.js';
import {
  productInput,
  addItemInput,
  paymentInput,
  id,
} from '../../src/validators/schemas.js';
describe('order lifecycle', () => {
  for (const [from, targets] of Object.entries(transitions)) {
    for (const to of Object.keys(transitions)) {
      it(`${from} -> ${to} is ${targets.includes(to) ? 'allowed' : 'rejected'}`, () => {
        if (targets.includes(to))
          expect(() => assertTransition(from, to)).not.toThrow();
        else expect(() => assertTransition(from, to)).toThrow();
      });
    }
  }
  it('reserves for exactly five minutes', () =>
    expect(RESERVATION_MS).toBe(300000));
});
describe('untrusted input', () => {
  it.each([
    { name: '', price: 1, stock: 1 },
    { name: 'a', price: -1, stock: 1 },
    { name: 'a', price: 1, stock: -1 },
    { name: 'a', price: 1.5, stock: 1 },
    { name: 'a', price: '1', stock: 1 },
    { name: 'a', price: 1, stock: 1, total: 5 },
  ])('rejects invalid product %j', (value) =>
    expect(productInput.safeParse(value).success).toBe(false),
  );
  it('rejects quantity zero', () =>
    expect(
      addItemInput.safeParse({
        productId: '11111111-1111-4111-8111-111111111111',
        quantity: 0,
      }).success,
    ).toBe(false));
  it('rejects invalid outcomes', () =>
    expect(paymentInput.safeParse({ outcome: 'paid' }).success).toBe(false));
  it('rejects unsafe IDs', () =>
    expect(id.safeParse("' OR 1=1 --").success).toBe(false));
});
