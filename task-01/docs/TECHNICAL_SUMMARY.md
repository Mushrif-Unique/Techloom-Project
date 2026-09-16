# Technical summary for an evaluation panel

1. **Architecture:** React/Vite/Tailwind calls thin Express controllers. Services implement business rules; repository helpers centralize transactions, locks, reads and database time. A background worker shares the same expiration service.
2. **Schema:** Seven relational entities: Product, Cart, CartItem, Order, OrderItem, Reservation and Payment. UUID foreign keys preserve history. CHECK and UNIQUE constraints enforce stock, quantities, totals, reservation duration, one order per cart and one payment per order/key.
3. **Checkout:** One transaction locks the cart, checks for a prior order, loads items, locks products in ID order, validates stock, deducts availability, snapshots prices, creates the order/reservations and closes the cart.
4. **Overselling:** Competing reservations wait on PostgreSQL row locks and see current committed stock before deducting. The nonnegative stock constraint independently rejects bad writes. No process-local mutex is involved.
5. **Reservations:** Available stock decreases at checkout. Each reservation expires exactly five minutes after its database-derived creation time; the schema enforces that interval.
6. **Expiration:** A deadline-aware worker plus inventory-read/checkout recovery lock the order, recheck the deadline and restore stock once. Checkout retries if inventory expires while waiting for product locks. Payment checks time after the order lock. Physical execution remains subject to process availability and lock waits.
7. **Payments:** Explicit mock outcomes produce PAID/CONSUMED, FAILED/RELEASED, or EXPIRED/EXPIRED. Success never deducts stock twice. Timeout immediately expires and restores.
8. **Duplicate rejection:** Cart/order uniqueness and row locks reject repeat checkout with HTTP 409 DUPLICATE_ORDER. Transaction-scoped advisory locks serialize a global payment key; repeated matching requests return 409 DUPLICATE_PAYMENT, while changed order/outcome returns IDEMPOTENCY_KEY_REUSED. Unique constraints protect persistence.
9. **Lifecycle:** A reusable transition validator enforces PENDING → RESERVED → PAID/FAILED/EXPIRED/CANCELLED, plus PAID → CANCELLED. Terminal invalid transitions fail. Stock restoration is centralized and conditional on reservation state.
10. **Security:** Zod, parameterized SQL, Helmet, strict CORS, body limits, rate limiting, safe errors and secret-free source. Production catalog mutations require a staff key. A version check protects stock from stale admin edits.
11. **Testing:** Unit state-machine/input tests and real PostgreSQL Supertest suites verify contention, duplicates, cross-order key collisions, lock-wait expiry, transaction rollback, stock edits, snapshots and cancellation. Browser checks verify the full customer flow.
12. **Deployment:** Static frontend, Node.js API, native PostgreSQL for development and CI, migrations, health checks, runtime secrets and managed database guidance. Public hosting is not configured.
13. **Trade-offs:** This is a shared, synthetic-data assessment sandbox. JavaScript follows the preferred stack. PENDING is internal to checkout; one mock attempt per order makes final states simple. Polling means cleanup processing may lag the exact deadline. Real use requires authentication, an inventory/audit ledger and verified gateway refunds.

## Core invariants

- Product.stock never becomes negative.
- A cart creates at most one order.
- An order creates at most one payment.
- A reservation's units are restored at most once.
- PAID consumes reservations; it does not restore availability.
- Expired orders cannot become paid.
- A failed checkout transaction leaves no partial business state.
- A stale stock edit cannot undo a concurrent reservation.
