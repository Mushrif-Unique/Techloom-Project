# Atelier — E-Commerce Checkout & Payment System

A complete customer-facing assessment store with a deliberately small architecture and rigorous checkout invariants. The `task-02` root remains unchanged. Twenty illustrated products span Electronics, Clothing, Accessories, Home, and Sports.

The refreshed interface uses charcoal and lime accents, rounded product cards, clear navigation, and a shared visual theme across discovery, account, cart, checkout, payment, and order pages. Responsive layouts are checked at 320, 390, 768, and 1440 pixels. Keyboard focus, a skip-to-content link, expanded filter state, and reduced-motion support are included. The redesign preserves existing API contracts and backend commerce logic.

## Stack and structure

React 19, Vite, JavaScript, React Router, Axios, Tailwind CSS 4, Express 5, Node.js, PostgreSQL, Prisma 6, JWT, bcrypt, Zod, Helmet, CORS, express-rate-limit, Vitest, and Supertest. JavaScript throughout; database schema and migrations are Prisma/SQL. Local SVG artwork is included; no remote image dependency.

```text
task-02/
  frontend/
    src/pages/          Discovery, details, auth, cart, checkout, payment, orders
    src/components.jsx Shared layout, summaries, error/empty/loading states
    src/styles.css     Base page layouts and component styles
    src/modern.css     Shared responsive charcoal-and-lime visual theme
    public/images/     Local product illustrations and hero artwork
    scripts/assets.js  Reproducible original SVG artwork
    vercel.json        SPA route fallback
  backend/
    src/services/      Auth, products, cart, checkout, inventory, gateway, payments, orders
    src/middleware/    JWT authentication
    src/lib/           Errors, state transitions, structured logging
    src/app.js         Validated REST routing and centralized error handling
    src/server.js      Startup, cleanup scheduler, graceful shutdown
    prisma/            Schema, committed migrations, idempotent seed
    tests/             Real PostgreSQL integration tests
    scripts/           Expiry cleanup and optional native local database helpers
  docs/                Verification record and requirement coverage
  render.yaml          Native Node backend deployment blueprint
```

The backend is a modular monolith: routes validate input and delegate to focused services. Services share transaction and transition utilities. The mock gateway is a pure deterministic function, so transaction retries never repeat a remote side effect.

## Local setup

Use Node.js 22.12+ (verified with 24.11.0), npm, and PostgreSQL 14+. Start in `task-02`.

### Windows PowerShell quick start

Use three terminals: database, API, and frontend. In each terminal, first run:

```powershell
cd "C:\Users\MUSHR\Desktop\Techloom Project\task-02"
```

For a fresh checkout, install the locked dependencies once before starting the services:

```powershell
npm.cmd ci
npm.cmd ci --prefix backend
npm.cmd ci --prefix frontend
```

**Terminal 1 — local database** (leave running):

```powershell
npm.cmd run db:local --prefix backend
```

Wait for `Native PostgreSQL running at 127.0.0.1:55432`. On first use the helper creates `backend/.env` with generated local credentials. If `.env` already exists, it is preserved: ensure its `DATABASE_URL` matches the connection saved in `backend/.local/dev/database.env`. Do not paste credentials into source control.

**Terminal 2 — API:**

```powershell
npm.cmd run generate --prefix backend
npm.cmd run deploy --prefix backend
npm.cmd run seed --prefix backend
npm.cmd run dev:backend
```

Here, `deploy` applies local database migrations; it does not publish the app. Generation, migrations, and seeding prepare a fresh checkout. For normal later starts, run only `npm.cmd run dev:backend` after starting the database.

**Terminal 3 — frontend:**

```powershell
npm.cmd run dev:frontend
```

Open the Local URL printed by Vite, normally [http://localhost:5173](http://localhost:5173). Both `localhost` and `127.0.0.1` work in development: browser requests use `/api` on the frontend origin, and Vite forwards them to `http://127.0.0.1:4000`. Register an account to try the store. Payments and refunds are simulated.

Stop the frontend and API with **Ctrl+C**, then stop the database terminal with **Ctrl+C**. If these services are already running, reuse them instead of starting duplicate instances. Ports are normally 5173 (frontend), 4000 (API), 55432 (development database), and 55433 (isolated test database). If Vite selects another port such as 5174, use its printed URL; the development proxy still works without changing backend CORS. Restart Vite after changing its configuration. To move the local API from port 4000, also update the proxy target in `frontend/vite.config.js`.

If `db:local` finds this project's database already running, it verifies its data directory, prints a message, and exits successfully. Keep using the original database terminal. A conflicting service on the same port is reported rather than reused. Concurrent isolated test runs are rejected to prevent them from clearing each other's data.

For a leftover database process or a `pre-existing shared memory block is still in use` startup error, stop this project's development cluster gracefully from the project root:

```powershell
npm.cmd run db:stop --prefix backend
npm.cmd run db:local --prefix backend
```

`db:stop` targets only `backend/.local/dev/data` and preserves the database files. Do not delete that directory or its lock files. If PostgreSQL is no longer running but Windows still reports shared memory in use, restart Windows before retrying.

`npm.cmd` avoids PowerShell's `npm.ps1` execution-policy issue. On macOS/Linux, use `npm` and your checkout's path. The alternative database setup below is for an existing PostgreSQL installation; choose one database option.

```sh
npm install
npm run install:all
```

### Option A: existing PostgreSQL installation or managed development database

Create an empty development database, for example with `createdb atelier` or pgAdmin. Copy `backend/.env.example` to `backend/.env` and set your connection URL, a generated JWT secret, and frontend origin. URL-encode special characters in database passwords. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and put its output only in the ignored environment file.

```sh
cd backend
npm run generate
npm run deploy
npm run seed
npm run dev
```

`npm run deploy` applies the committed migrations. When developing new schema changes, use `npx prisma migrate dev --name meaningful_change`; production must use `prisma migrate deploy`. `npm run seed` creates twenty products and preserves existing prices and inventory on subsequent runs.

### Option B: optional native local PostgreSQL helper

If PostgreSQL is not installed, the development dependency `embedded-postgres` supplies native PostgreSQL binaries for supported platforms. The helper creates only project-local data and generated credentials in ignored files, binds to `127.0.0.1`, and uses SCRAM authentication.

In a separate terminal, from `backend`:

```sh
npm run db:local
```

Leave it running. On the first run it creates `backend/.env` with generated secrets. If an environment file already exists, it preserves it and saves the local URL in `backend/.local/dev/database.env` for you to copy. Development PostgreSQL uses port **55432**. Then run generation, migrations, seed, and the API commands from Option A in another terminal. Stop the helper with Ctrl+C. Run as a normal operating-system user.

### Frontend

From another terminal:

```sh
cd frontend
# Copy .env.example to .env, adjusting the API URL when needed.
npm run dev
```

Open Vite's printed Local URL. API: `http://localhost:4000/api`; database-aware health check: `/api/health`. Register your own account; there are no hard-coded account credentials. Development always uses the same-origin `/api` proxy and does not require a frontend environment file. `VITE_API_URL` is used by production builds, including `vite preview`; set it explicitly for a deployed frontend. Production still requires the backend's `FRONTEND_URL` to match the deployed frontend origin exactly.

## Environment

| Variable                   | Where             | Purpose                                                            |
| -------------------------- | ----------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`             | Backend           | PostgreSQL URL; use the managed provider's required TLS parameters |
| `JWT_SECRET`               | Backend           | Random secret, at least 32 characters                              |
| `FRONTEND_URL`             | Backend           | Exact allowed frontend origin, no trailing slash                   |
| `NODE_ENV`                 | Backend           | `development`, `test`, or `production`                             |
| `PORT`                     | Backend           | HTTP port; default 4000, supplied by Render in production          |
| `RESERVATION_TTL_MINUTES`  | Backend           | Reservation duration; default 10, maximum 60                       |
| `CLEANUP_INTERVAL_SECONDS` | Backend           | Background expiry sweep; default 30                                |
| `TEST_DATABASE_URL`        | Test process only | Isolated database whose name ends in `_test`                       |
| `VITE_API_URL`             | Frontend build    | Full API base URL including `/api`                                 |

Backend environment validation fails startup with variable names only, never secret values. Real `.env`, local databases, generated credentials, logs, modules, and build output are ignored. Only `.env.example` is intended for version control.

## Database models

`User`, `Product`, `Cart`, `CartItem`, `CheckoutSession`, `StockReservation`, `Payment`, `Order`, `OrderItem`, `Refund`, and `OrderStatusHistory` form the normalized relational schema. Each user has one cart. A checkout owns reservations, at most one payment, and at most one order. An order owns item snapshots, status history, and at most one refund. Refunds are also unique per payment.

Money uses PostgreSQL `numeric(12,2)` and Prisma Decimal arithmetic. API monetary values serialize as strings. The frontend only formats them for display. Checkout snapshots include the product name, image, unit price, quantity, and line total; later catalogue changes cannot rewrite historical orders.

The second migration adds check constraints for positive amounts, valid quantities, line totals, and `0 <= reservedQuantity <= stockQuantity`. A partial unique index permits only one active checkout per user. Other indexes cover product categories, expiry cleanup, and user order history.

## Inventory and concurrency

`stockQuantity` is physical stock; `reservedQuantity` is the amount held by active checkouts. Available stock is their difference. Cart additions do not reserve anything. Availability search compares these two database columns.

Checkout reads the cart and trusted product prices, then reserves each product with a conditional SQL update inside a Prisma **Serializable** transaction:

```sql
UPDATE "Product"
SET "reservedQuantity" = "reservedQuantity" + :quantity
WHERE id = :productId
  AND active = true
  AND "stockQuantity" - "reservedQuantity" >= :quantity;
```

All raw SQL values are parameterized. Products are processed in a consistent order. A zero-row update rejects checkout; the transaction rolls back every prior reservation. Serialization conflicts and deadlocks retry the entire database-only operation up to six times with jitter, including PostgreSQL `40001`/`40P01` codes wrapped by Prisma raw-query errors. This follows [Prisma's transaction guidance](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions). Database constraints provide independent protection.

Success decrements physical and reserved stock once and consumes reservations. Failure/cancellation decrements only reserved stock. Expiry marks active reservations expired and releases held stock. A successful order cancellation restores physical stock once; the original consumed reservation stays consumed for audit history.

Expiry runs on catalogue/cart/checkout/payment operations and every 30 seconds while the API is awake. A manual `npm run cleanup` drains expired batches. A closed browser cannot permanently hold stock; after a server restart, startup and request-time cleanup recover expired sessions. Sweeps process 100 sessions per batch to bound request work.

## State machines and payment reliability

Prisma enums centralize status names. `src/lib/states.js` defines permitted transitions and rejects invalid ones:

```text
Checkout: RESERVED → PAYMENT_PROCESSING → COMPLETED | PAYMENT_FAILED | PAYMENT_TIMEOUT
          RESERVED → EXPIRED | CANCELLED
          PAYMENT_TIMEOUT → PAYMENT_FAILED (reconciled no-charge result)
Payment:  PENDING → PROCESSING → SUCCESS | FAILED | TIMEOUT
          TIMEOUT → FAILED (reconciliation only)
Reserve:  ACTIVE → CONSUMED | RELEASED | EXPIRED
Order:    CONFIRMED → CANCELLED | FAILED → REFUND_PENDING → REFUNDED
Refund:   PENDING → PROCESSING → SUCCESS | FAILED
```

Checkout and pay endpoints require an `Idempotency-Key` header: 16–100 letters, digits, underscores, or hyphens. UUIDs are recommended. Checkout keys are unique per user. Repeated checkout creation returns the original result; another key also resumes an existing active checkout. Generate a fresh key only when intentionally starting a new checkout.

Payment keys are globally unique. Each checkout has a unique payment and order foreign key. The same key and scenario replay the persisted result. Reusing a key with another checkout/scenario returns 409. A different key cannot charge a checkout that already has a payment. Concurrent double-clicks therefore cannot produce another charge or order.

Payment, inventory consumption, order snapshot/history creation, and cart clearing commit together. Only cart rows still matching the checkout snapshot are removed; changes made after checkout are preserved. The browser disables its pay button and retains only an idempotency key plus scenario label in session storage for transport retries. Card numbers and CVVs are never persisted or logged.

### Mock scenarios

| Test card             | Outcome           | Recovery                                                                 |
| --------------------- | ----------------- | ------------------------------------------------------------------------ |
| `4242 4242 4242 4242` | Success           | One confirmed order; stock consumed                                      |
| `4000 0000 0000 0002` | Declined          | Reservation released; start fresh checkout                               |
| `4000 0000 0000 9995` | Timeout / unknown | Hold reservation; reconcile the existing attempt                         |
| `4000 0000 0000 9987` | Paid order fails  | Successful mock charge, order failure, automatic full refund and restock |

No expiry/CVV is required. These are the only accepted test values. The UI exposes named scenario buttons.

Select **Paid order fails** to demonstrate a successful payment followed by simulated fulfilment failure. The payment remains `SUCCESS` with its original transaction reference; the order records `CONFIRMED → FAILED → REFUND_PENDING → REFUNDED`. A separate refund returns the full trusted payment amount and stock is restored exactly once. The payment page shows refund confirmation instead of a shipping/success message, and order detail shows the failure reason and complete timeline. Reloads and identical retries return the saved result; another payment key is rejected. Cancelling an already automatically refunded order also returns the existing result.

This is a deterministic, synchronous mock: charge, order failure, compensating refund, and stock updates commit in one database transaction. It demonstrates the post-payment failure outcome without an external provider or asynchronous fulfilment worker. Real gateway integration still requires the durable reconciliation architecture described below.

A timeout is **not** initially treated as a decline. It persists `TIMEOUT`, creates no order, and retains the reservation. Retrying the same key replays that state; a new key is rejected. **Check payment result** calls reconciliation, which deterministically confirms **NOT_CHARGED** for this mock scenario, changes payment/checkout to failed, and releases stock. Expiry cleanup does the same if the customer abandons the page. After reconciliation a new checkout can succeed. There is never an additional charge within the timed-out checkout.

This no-charge resolution is a documented property of the internal mock, not a claim about real gateways. Connecting a real provider would require a durable attempt/outbox, provider-side idempotency, webhook verification, and reconciliation before releasing potentially charged inventory.

## Cancellation, refund, and history

Unpaid checkout cancellation releases the reservation without creating a refund. Paid orders are cancellable while `CONFIRMED`; this assessment simulates fulfilment failure but does not model real shipment. Cancellation and automatic paid-order failure share a transactional refund helper. Each restores purchased stock once, creates a unique full refund using the original payment amount, and records either `CANCELLED` or `FAILED`, followed by `REFUND_PENDING` and `REFUNDED`. The mock refund succeeds synchronously. Duplicate or concurrent cancellations replay the refunded result without touching inventory again.

All order status transitions have timestamps and a monotonically ordered sequence. Order detail also shows checkout/reservation and successful-payment timestamps. Refund information and payment references are visible only to the owner.

## API overview

All routes are under `/api`. Success is `{ success: true, data: ... }`; failures are `{ success: false, error: { code, message } }`. Validation uses 422, bad JSON 400, missing/invalid authentication 401, unknown or non-owned resources 404, conflicts 409, and unexpected failures 500. Creation routes return 201.

| Method | Endpoint                        | Behavior                                              |
| ------ | ------------------------------- | ----------------------------------------------------- |
| GET    | `/health`                       | Database-aware readiness                              |
| POST   | `/auth/register`, `/auth/login` | Register/sign in; return user and 8-hour JWT          |
| GET    | `/auth/me`                      | Current public user fields                            |
| GET    | `/products`                     | Backend search/category/price/availability/sort/page  |
| GET    | `/products/:id`                 | Active product details and actual available quantity  |
| GET    | `/cart`                         | Current items, trusted subtotal, item count           |
| POST   | `/cart/items`                   | `{ productId, quantity }`; add/increment              |
| PATCH  | `/cart/items/:id`               | `{ quantity }`; set positive integer quantity         |
| DELETE | `/cart/items/:id`               | Remove owned item                                     |
| POST   | `/checkout`                     | `{}` + idempotency key; reserve or resume             |
| GET    | `/checkout/:id`                 | Owned session, reservations, payment, order reference |
| POST   | `/checkout/:id/cancel`          | `{}`; release unpaid reservation                      |
| POST   | `/payments/:id/pay`             | `{ cardNumber }` + idempotency key; ID is checkout ID |
| POST   | `/payments/:id/reconcile`       | `{}`; resolve existing timeout without charging       |
| GET    | `/orders`, `/orders/:id`        | Owned orders, snapshots, history, payment, refund     |
| POST   | `/orders/:id/cancel`            | `{ reason? }`; idempotent full simulated refund       |

Product query example: `/api/products?search=keyboard&category=Electronics&minPrice=20&maxPrice=150&available=true&sort=price_asc&page=1&limit=12`. Categories are exact names; search is case-insensitive over name/description and treats wildcard characters literally. `available=false` requests out-of-stock products. Sort options: `featured`, `price_asc`, `price_desc`, `name`. Default page size 12, maximum 50. Unknown filters, malformed UUIDs, invalid quantities, and client-provided price/amount fields are rejected.

Protected requests require `Authorization: Bearer <token>`. Ownership is checked in database queries, not inferred from URL IDs. CORS is only an origin policy, never authorization.

## Security and logging

Bcrypt cost 12; passwords are 10–72 characters with a 72-byte limit. JWTs use HS256 with fixed issuer/audience and expiration. Password hashes never appear in API responses. Tokens live in browser session storage, disappear when the session closes, and are removed on logout/401. A future production hardening step is HttpOnly cookie sessions with CSRF protection and revocation.

Helmet, explicit-origin CORS, a 16 KB JSON limit, general/auth rate limits, Zod strict payload schemas, safe parameterized queries, and startup environment validation are included. The production proxy trust is one hop for Render. Error responses never expose stack traces or database details. Structured operation logs contain IDs and outcomes only, never request bodies, passwords, tokens, payment inputs, or connection strings. In-memory rate limiting assumes a single API instance.

## Tests and quality checks

The integration suite runs against **real PostgreSQL**, exercising the HTTP API with Supertest. It does not mock Prisma or concurrency.

Easiest isolated native run:

```sh
cd backend
npm run generate
npm run test:local
```

This starts a separate database on port 55433, applies migrations, runs Vitest, and stops PostgreSQL. Test state stays under ignored `.local/test`. With an existing PostgreSQL server, create `atelier_test`, set `TEST_DATABASE_URL`, apply the migrations to that database using `DATABASE_URL`, and run `npm test`. The test setup refuses any database name that does not end in `_test`. **All data in that test database is cleared between cases. Never point it at customer data.**

From the project root:

```sh
npm run test:local
npm run build
npm run format:check
npm audit
npm audit --prefix backend
npm audit --prefix frontend
```

On Windows, substitute `npm.cmd` for `npm`. `npm test` alone requires an already configured isolated test database; `npm run test:local` provisions and stops its own. These checks do not require the frontend or development API to be running.

To check the running development API from PowerShell:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

Expected result: `success` is `True`, and `data.status` is `ok`. Latest executed results and responsive browser checks are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md). Browser screenshots and the local QA harness live under ignored `test-results/`; they are environment-specific verification artifacts, not an installed project test dependency.

Tests cover authentication, filters, validation, cart edits, atomic checkout, insufficient inventory, final-item races, expiry, authorization, duplicate keys, concurrent payment requests, immutable snapshots, cart preservation, decline/timeout recovery, full refunds, repeated cancellations, timelines, and database constraints. See [verification evidence](docs/VERIFICATION.md) and [requirement coverage](docs/REQUIREMENTS.md) for the executed results and manual test record.

## Deployment

Local checks are complete as recorded in the verification document; public hosting and remote smoke tests are a separate step. Commit all three `package-lock.json` files with the source, all three Prisma migrations, local image assets, `render.yaml`, and `frontend/vercel.json`. Keep `.env`, `.local`, `node_modules`, `dist`, and `test-results` out of the repository. If this app is pushed inside a larger repository, set each platform's root directory to the actual path to `backend` or `frontend` in that repository.

Prepare a managed PostgreSQL URL, an API URL, and the final frontend origin. The native local database helper is for development/tests; hosted services use `DATABASE_URL` for the managed database. Update both `VITE_API_URL` and `FRONTEND_URL` for the hosted origins, then run the remote smoke checks below before calling deployment complete.

### Backend: Render + managed PostgreSQL

1. Push this repository to your source host. Create a managed PostgreSQL database and use the provider's connection URL and required TLS configuration. A same-region private URL is preferable on Render.
2. Import `render.yaml` as a Render Blueprint, or create a native **Node** Web Service with root `backend`.
3. Build: `npm ci --include=dev && npm run generate`. Start: `npm run deploy && npm start`. The startup migration uses production-safe committed migrations and prevents the API starting on an outdated schema. For a paid service, it can instead run as a pre-deploy command before scaling.
4. Set `DATABASE_URL`, `FRONTEND_URL` to the final Vercel origin, and a random `JWT_SECRET`. The blueprint generates the secret and configures other defaults. Render supplies `PORT`. Health path: `/api/health`.
5. Seed once using `npm run seed` in the service shell, or run the same seed locally with the managed database connection in an ignored environment file. Seeding is intentionally not part of every deployment.
6. Verify `/api/health`, authentication, one successful payment, and refund against the deployed database. Keep managed backups enabled according to your assessment environment's plan.

The blueprint configures only the API; the database URL is supplied explicitly so it can use your chosen managed PostgreSQL service. No deployment credentials were supplied in this workspace, so public deployment is not claimed. See [Render Node deployment](https://render.com/docs/deploy-node-express-app) and the [Blueprint reference](https://render.com/docs/blueprint-spec).

### Frontend: Vercel

1. Import the same repository, select root **frontend**, and choose the Vite framework preset.
2. Install `npm ci`; build `npm run build`; output `dist`.
3. Set `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api` before building. Rebuild when changing this value.
4. `frontend/vercel.json` sends application routes to `index.html` while preserving `/assets/` and `/images/`. Refresh `/orders`, `/checkout`, and a product URL to verify SPA routing.
5. Set backend `FRONTEND_URL` to the exact HTTPS Vercel origin, without a trailing slash. Preview domains are intentionally not wildcard-allowed; configure a separate backend environment if needed.

See [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite). All image assets are bundled with the frontend; product image URLs are origin-relative.

## Assumptions and boundaries

- Exact-brief audit: refunds for both cancelled paid orders and simulated failed paid orders are implemented. Decline is uncharged; timeout resolves to no charge. Public deployment remains pending; see [requirement coverage](docs/REQUIREMENTS.md).
- Currency is USD. Delivery and tax are zero in this assessment; the server returns the complete total.
- Products represent single SKUs. Clothing has a documented standard fit; variants, addresses, real delivery, admin inventory management, and fulfilment are outside this assignment.
- Every confirmed order remains refundable because shipment is not modeled. Refund simulation is full-only and synchronous.
- Payment timeouts resolve to no charge, as described above. No real payment network is contacted.
- Read-time expiry cleanup is bounded; the scheduled worker continues processing additional batches. A sleeping host releases expired reservations when it next wakes or receives a request.
- JWT logout removes the local token; tokens remain valid until expiry. The rate-limit store is process-local. Multi-instance production hardening would add durable sessions and a shared rate-limit store.
- Prisma 6 is pinned for its verified transactional API; overrides update vulnerable development-tool transitive dependencies. Test/build verification covers these overrides.
- For a production business, add email verification/password recovery, fulfilment cutoffs, observability/alerts, database recovery drills, and the real gateway architecture described above.
