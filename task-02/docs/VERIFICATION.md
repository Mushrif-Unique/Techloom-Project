# Verification record

Executed locally on 2026-09-17 with Node.js 24.11.0, native PostgreSQL 18.4, Prisma 6.19.0, Vitest 4.1.11, and Vite 7.3.6.

## Automated checks

- `npm run test:local` from the project root: **33 tests passed, 1 test file passed**, exit 0. Latest recorded run duration: 62.60 seconds. The runner uses a separate PostgreSQL database on port 55433, applies committed migrations, exercises real concurrent HTTP requests through Supertest, and shuts down the native database.
- `npm run build` from the project root: **passed**, 1,656 modules transformed. Output is `frontend/dist`.
- `npx prisma validate`: **passed**.
- `npx prisma migrate status`: **database schema is up to date**, both migrations applied.
- `npm run seed`: **passed** for twenty products, including a second invocation that preserves inventory and prices.
- Backend startup: **passed**, listening on port 4000. `GET /api/health` returned HTTP 200 with `{ "success": true, "data": { "status": "ok" } }` against PostgreSQL.
- Fresh `npm audit` runs for the root, backend, and frontend: **zero reported vulnerabilities** in all three dependency trees.
- `npm run format:check`: **passed**, all matched source files conform to Prettier.
- Source review: no required-feature TODO/FIXME placeholders or prohibited infrastructure files; no hard-coded real credentials. Local secrets are generated into ignored files.

The initial concurrency test caught a raw-query serialization failure being surfaced as HTTP 500. Retrying PostgreSQL codes `40001` and `40P01` in addition to Prisma `P2034` fixed it. The final last-item test returns one 201 and one 409, with exactly one reservation. The native Windows test helper was also corrected to use graceful PostgreSQL shutdown instead of leaving an orphan worker.

## Browser checks

### Modern UI regression check — 2026-09-17

The charcoal-and-lime redesign was rechecked with headless Microsoft Edge against the running frontend and real development API/PostgreSQL. No uncaught browser JavaScript errors were recorded. Screenshots were captured and document-width assertions passed at **320, 390, 768, and 1440 pixels** for each of these 12 screens/states: catalog, expanded filters, registration, product detail, populated cart, checkout review, payment, order detail, order list, declined payment, persisted payment timeout, and 404. This is 48 viewport checks. Desktop/mobile catalog and narrow product/payment screenshots were visually inspected during the redesign.

The browser flow passed category selection, price filter and sort controls, search, pagination, registration, logout, protected-route redirection, login, empty cart, product-to-cart addition, quantity increase/decrease, checkout reservation, successful simulated payment, order details/list, cancellation and full simulated refund. It also passed decline recovery, timeout persistence after reload, reconciliation, fresh checkout after reconciliation, unpaid cancellation, item removal, 404 display, and network-error retry after restoring connectivity.

The QA customer and its simulated refunded order remain in the local development database. The successful extended run ended with an empty cart and no active reservation for that customer. The browser harness and screenshots are under ignored `test-results/` and rely on this workstation's Playwright/Edge installation; they are not a portable package script.

The README now includes the Windows three-terminal startup, fresh-install commands, local migration/seed steps, exact localhost/CORS requirement, port troubleshooting, test commands, new UI files, and deployment prerequisites. Both development migrations were confirmed applied. Two additional seed runs passed, and an API snapshot comparison confirmed product IDs, prices, and available quantities were unchanged.

### Earlier end-to-end verification

Using the running frontend and real local API/database:

1. Registered a demonstration customer, signed out, and signed in again.
2. Searched for `keyboard`, combined Electronics category, $100–$120 price range and in-stock filtering; the $115 Quiet Mechanical Keyboard was the matching product.
3. Opened product details, added an item, increased then decreased bag quantity, and created checkout. Verified the price breakdown and reservation countdown.
4. Used the successful mock payment. Verified confirmation, empty bag, order detail, stored price, payment reference and timeline.
5. Cancelled that order. Verified full $115 refund, refunded status and the cancellation/refund timeline entries.
6. Added Studio Headphones and used the decline scenario. Verified payment failed, reservation ended, and the fresh-checkout action.
7. Created a fresh checkout with the timeout scenario. Reloaded the page and verified the unresolved state persisted. Reconciled the existing attempt and verified the no-charge result and ended reservation.
8. Started a fresh checkout after reconciliation, paid successfully, and verified the order list contained the confirmed headphone order and the earlier refunded keyboard order.
9. Reviewed desktop layout and a 390 × 844 mobile viewport. The hero and two-column mobile product grid rendered without horizontal overflow. Reset the viewport afterward.

A separate live-HTTP concurrency smoke check against the running API on port 4000 created two customers competing for a single verification SKU. It returned **201 and 409**, held exactly one reservation, and restored availability to one after cancellation. The verification product was then made inactive. Duplicate payment/cancellation behavior is also covered by simultaneous real PostgreSQL integration requests. The browser scenarios use only the internal mock; no real card or payment provider was involved.

## Local database startup recovery — 2026-09-17

After a reported Windows shared-memory startup error, the local database was successfully restarted with its existing data. The helper now verifies an existing development server's data directory and exits successfully on duplicate startup; a test port already in use fails safely instead of reusing a database under test. Added `npm run db:stop --prefix backend`, scoped to this checkout's development cluster, for graceful shutdown without deleting data.

Verified start, duplicate start, database-aware API health, graceful stop, repeated stop while already stopped, restart, and helper exit after external shutdown. All passed. The integration suite passed again: **33 tests, 59.70 seconds**. Formatting passed. The verification database instance was stopped afterward so the user can own startup in their terminal.

## Development origin/proxy fix — 2026-09-17

Reported browser origin `http://127.0.0.1:5174` differed from the API's configured CORS origin. Development Axios requests now use same-origin `/api`; Vite forwards them to `http://127.0.0.1:4000`. Production builds still use `VITE_API_URL`, and backend CORS and commerce logic are unchanged. README and the frontend environment example reflect this distinction.

Verified proxied database health on both `localhost:5174` and `127.0.0.1:5174`. The full browser regression flow and 48 viewport checks passed again at the reported `127.0.0.1:5174` origin, including authenticated mutations, checkout/payment idempotency headers, refunds, decline/timeout recovery, and retry after a simulated network failure. No uncaught browser JavaScript errors occurred. Production build and repository formatting checks passed.

## Deployment status

Exact-brief audit rerun: **33/33 integration tests passed** (68.09 seconds); production build and formatting passed; the complete browser regression flow and 48 viewport checks passed at `127.0.0.1:5174`. These results cover implemented behavior, not the missing failed-after-payment order/refund scenario identified in [REQUIREMENTS.md](REQUIREMENTS.md).

Render/Vercel configuration and exact deployment instructions are included. No Render or Vercel deployment credentials were present in the task environment. No public deployment or remote smoke test is claimed.
