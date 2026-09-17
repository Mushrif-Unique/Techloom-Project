# Requirement coverage

The main shopping and payment flows are implemented. Auditing the exact supplied brief identifies two outstanding items: a distinct failed-after-payment order/refund scenario is not modeled, and the app is not yet deployed to a public URL. Evidence below separates implemented behavior from checks actually executed.

## Exact assignment audit

| Requirement / evaluation area                                | Status   | Evidence and limitation                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product listing, search, category/price/availability filters | Covered  | Server-side combined filters and pagination; integration assertions and browser checks.                                                                                                                                                                                                |
| Full single-product details                                  | Covered  | Name, description, image, category, price, stock, quantity, add-to-cart.                                                                                                                                                                                                               |
| Cart management                                              | Covered  | Add, increment, decrease, remove, count, trusted server subtotal.                                                                                                                                                                                                                      |
| Reserve stock before payment                                 | Covered  | Serializable checkout transaction; conditional stock reservation and immutable item snapshot.                                                                                                                                                                                          |
| Release stock when payment does not complete                 | Covered  | Decline, unpaid cancellation, reservation expiry; unresolved timeouts retain stock until reconciliation/expiry.                                                                                                                                                                        |
| Mock success, failure, timeout                               | Covered  | Three explicit scenarios; persisted timeout and no-charge reconciliation.                                                                                                                                                                                                              |
| Prevent duplicate charges/orders                             | Covered  | Persisted keys, unique checkout payment/order constraints, concurrent request tests.                                                                                                                                                                                                   |
| Cancel paid order and simulate refund                        | Covered  | Full refund, exactly-once restock, ordered status history; concurrent cancellation tested.                                                                                                                                                                                             |
| Refund a failed paid order                                   | Gap      | No post-payment order-failure transition or compensating refund scenario. Payment and order creation commit atomically in the internal mock; a declined payment is never charged and does not require a refund. This is not equivalent to demonstrating a paid order that later fails. |
| User order history with current and past statuses            | Covered  | Owner-scoped list/detail and timestamped confirmed/cancelled/refund-pending/refunded history. Declined/timeout checkouts are not paid orders.                                                                                                                                          |
| Allowed backend/frontend/database                            | Covered  | Node.js/Express, React, PostgreSQL/Prisma.                                                                                                                                                                                                                                             |
| Clean, modular, documented code                              | Reviewed | Focused services, shared transaction/state/validation helpers, README, formatting checks, automated tests. Quality remains an evaluator judgment.                                                                                                                                      |
| Live publicly accessible URL                                 | Pending  | Render/Vercel configuration exists; localhost and successful local builds do not satisfy deployment.                                                                                                                                                                                   |

Before claiming complete assignment coverage, add and test a paid-order failure/refund path (or obtain explicit acceptance that the atomic mock excludes this case), then deploy and verify a public URL. No feature implementation or deployment was performed as part of this audit.

Post-redesign recheck on 2026-09-17: all 33 integration tests, production build, schema validation, migration status, and dependency audits passed. The refreshed UI passed 48 viewport checks across 12 screens/states at 320, 390, 768, and 1440 pixels, plus the complete purchase/refund and decline/timeout recovery browser flows. See [the current verification record](VERIFICATION.md) for scope and results. Backend logic and API contracts were not changed by the UI redesign.

| Area                                       | Implementation                                                                                       | Verification                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Required stack, JavaScript, unchanged root | React/Vite/Router/Axios/Tailwind; Express/Prisma/PostgreSQL; `task-02`                               | Package manifests, schema validation, build, API startup                             |
| Professional responsive discovery          | Search, exact category, price range, availability, sorting, pagination, clear filters                | Integration filters and browser combined-filter flow; desktop/mobile review          |
| Product details                            | Name, local image, description, category, authoritative price, available stock, quantity, add to bag | Browser product-to-cart flow; missing/inactive product tests                         |
| Registration/login                         | Bcrypt, JWT, validated payloads, protected frontend routes                                           | Integration and browser registration/logout/login                                    |
| Ownership                                  | Scoped cart, checkout, payment, order and refund access                                              | Another user's reads, edits, payments, reconciliation and cancellation rejected      |
| Cart                                       | Add/increment, quantity update/decrease, remove, counts, Decimal subtotals                           | API tests and browser quantity changes                                               |
| Trusted money                              | Decimal database and arithmetic, strict payload schemas, server prices and refunds                   | Exact subtotal, tampered price/amount rejection, snapshot tests                      |
| Atomic checkout                            | Non-empty cart, active products, stock checks, snapshot, configurable deadline                       | Checkout, insufficient stock, rollback and deadline tests                            |
| Stock reservation                          | Physical/reserved counters; ACTIVE/CONSUMED/RELEASED/EXPIRED                                         | Success/failure/cancel/expiry tests                                                  |
| Concurrency                                | Serializable transactions, conditional update, retries, SQL check constraints                        | Simultaneous last-item reservations; one winner, one 409                             |
| Abandoned reservations                     | Request-time cleanup, background sweep, cleanup command, startup sweep                               | Forced deadline expiry and abandoned timeout tests                                   |
| Mock gateway                               | Explicit success/decline/timeout test values, no card persistence                                    | All scenarios through API and browser                                                |
| Idempotency                                | Persisted unique key, scenario binding, unique payment/order per checkout                            | Same-key concurrency, different keys, changed request and duplicate order constraint |
| Payment success                            | Atomic payment/order/consumption/history/cart update                                                 | API test and full browser purchase                                                   |
| Payment failure                            | Definitive failure releases reservations; fresh checkout required                                    | API and browser decline recovery                                                     |
| Timeout/retry                              | Durable unknown state, same-key replay, explicit or expiry reconciliation to no charge               | API retries plus browser reload, reconciliation and subsequent successful checkout   |
| Order snapshots                            | Name, price, image, quantity, line total fixed at checkout                                           | Catalogue mutation after checkout does not alter purchase                            |
| Order list/detail/history                  | Owned list, payment/refund data, timestamped timeline                                                | API ownership/history tests and browser order list/detail                            |
| Cancellation and refund                    | Unpaid checkout release; paid full refund, exactly-once restock                                      | Concurrent cancellation test and browser refund timeline                             |
| State machine                              | Prisma enums and central transition rules                                                            | Invalid transitions rejected; valid sequences recorded                               |
| Validation/errors                          | Zod, malformed UUID handling, JSON errors, consistent envelopes                                      | Invalid input, auth, ownership, stock and conflict tests                             |
| Security                                   | Helmet, explicit CORS, rate limits, bcrypt, JWT, parameterization, env validation                    | Header/origin tests, source review, secret scan and dependency audit                 |
| UI completion                              | All nine routes, protected pages, 404, empty/loading/error states, notifications                     | Browser flows and production build                                                   |
| Seed/assets                                | Twenty products, five categories, two out-of-stock SKUs, local SVGs                                  | Seed and idempotent reseed executed; images inspected in browser                     |
| Logging                                    | Structured checkout, payment attempt/result, release/cancel, reconciliation/refund/expiry events     | Live server output and source review; no sensitive payload logs                      |
| Automated testing                          | Vitest/Supertest with native PostgreSQL                                                              | 33 passing integration tests; no database mocks                                      |
| Build/start/migrations                     | Vite build, validated Prisma schema, two committed SQL migrations, startup health                    | All executed successfully                                                            |
| Deployment readiness                       | Render Node blueprint, Vercel SPA config, environment examples and instructions                      | Local validation only; no public deployment claimed                                  |
| Documentation and code quality             | Focused services, shared utilities, Prettier, README, verification notes                             | Formatting check and requirement review                                              |

## Business invariants

1. Available stock cannot go below zero: conditional transactional reservation and SQL constraints.
2. Active reservations reduce available stock: reserved counter updated in the same transaction.
3. Release/expiry restores availability: reservation transition and counter decrement are atomic.
4. One checkout has at most one order: unique `Order.checkoutSessionId`.
5. Repeated charge requests cannot create multiple payments: unique key and unique `Payment.checkoutSessionId`.
6. Repeated requests cannot create another order: unique order plus persisted payment replay.
7. Successful payment consumes inventory once: one transaction and terminal checkout/payment state.
8. Decline releases stock: failed payment and released reservations commit together.
9. Timeout retry is safe: replay/reconcile existing attempt; another charge key is rejected.
10. Cancellation restores inventory once: terminal state check within Serializable transaction.
11. Refund happens once: unique order/payment refund constraints.
12. Resource access is owner-scoped on the server.
13. Client financial values are rejected; calculations use database Decimal values.
14. Order snapshots retain the checkout's purchased name/price.
15. Every important order status transition has a timestamped, sequenced history row.

## Assessment boundaries

The internal mock has no external side effects; its timeout always reconciles to no charge, and refunds always succeed. Delivery, fulfilment, real payment providers, multi-currency, partial refunds, and account recovery are outside the requested mini-store. Operational production hardening limitations are documented in README rather than presented as completed features.
