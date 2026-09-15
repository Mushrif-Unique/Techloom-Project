# Verification and requirement checklist

Verified locally on 15 September 2026 against real PostgreSQL 17.

## Results

- **89 automated tests passed:** 46 unit tests and 43 API/integration/concurrency tests.
- **Overselling:** 20 simultaneous checkouts against 5 units produced exactly 5 reservations and 15 insufficient-stock responses. Ten simultaneous checkouts against one unit produced exactly one reservation.
- **Duplicate checkout:** ten concurrent submissions created one order and deducted stock once.
- **Duplicate payment:** concurrent success, failure and timeout requests with one key created one payment and settled inventory once.
- **Additional races:** different keys for one order, one key across different orders, reversed cart-product order, concurrent cart edits, stale stock edits, and repeated paid cancellations passed.
- **Expiry:** payment blocked on a row lock past its deadline was rejected; deadline/payment/failure races preserved consistent stock and reservation status.
- **Worker:** the real interval-based worker expired a test reservation and restored inventory without an HTTP access.
- **Rollback:** an injected PostgreSQL trigger failed order creation after inventory deduction; the entire checkout rolled back.
- **Security:** invalid inputs, malformed JSON, oversized payloads, configured staff-key checks, exact CORS origin, and hidden powered-by header passed.
- **Build:** backend Prisma generation/syntax check and frontend Vite production compilation passed.
- **Quality:** ESLint and Prettier checks passed after formatting corrections.
- **Dependencies:** clean lockfile installation reported zero known npm audit vulnerabilities, including development dependencies.
- **Containers:** frontend/backend images built successfully; PostgreSQL, API and Nginx containers reported healthy.
- **Browser:** development UI verified product browsing, adding an item, quantity changes, checkout, five-minute countdown, payment success and paid-order cancellation. UI displayed PAID/CONSUMED followed by CANCELLED/RELEASED; catalog stock returned from 46 to 48 for the mouse.
- **Responsive:** the order page was checked at a 390 px viewport with no horizontal document overflow.

## Assignment checklist

| Requirement                                   | Status | Evidence                                                                  |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Product CRUD                                  | [x]    | Product API integration suite; soft-deactivation preserves rows           |
| Accurate current inventory                    | [x]    | Product stock assertions; version protection; dashboard expiry regression |
| Cart creation                                 | [x]    | API fixture and cart integration tests                                    |
| Add/remove/update cart items                  | [x]    | Cart API suite; browser quantity update                                   |
| Checkout                                      | [x]    | Integration and browser checkout                                          |
| Stock validation                              | [x]    | Insufficient-stock rollback; database CHECK                               |
| Concurrent checkout protection                | [x]    | 20/5 and 10/1 contention tests                                            |
| No overselling                                | [x]    | Exact success counts, zero final stock, reserved-unit sums                |
| Five-minute reservation                       | [x]    | Exact duration assertion and database CHECK                               |
| Automatic reservation expiration              | [x]    | Actual scheduled-worker test                                              |
| Immediate restoration after expiry processing | [x]    | Expiration transaction assertions                                         |
| Payment success                               | [x]    | API and browser                                                           |
| Payment failure                               | [x]    | API and concurrent replay tests                                           |
| Payment timeout                               | [x]    | API; EXPIRED state and stock restoration                                  |
| Duplicate checkout protection                 | [x]    | One order per cart, concurrent requests                                   |
| Duplicate payment protection                  | [x]    | Unique key/order, same-key and different-key races                        |
| Pending status                                | [x]    | PENDING created inside checkout; transition utility tests                 |
| Reserved status                               | [x]    | Successful checkout assertions                                            |
| Paid status                                   | [x]    | Successful payment assertions                                             |
| Failed status                                 | [x]    | Failed payment assertions                                                 |
| Cancelled status                              | [x]    | Reserved/paid repeated cancellation tests                                 |
| Expired status                                | [x]    | Timeout, lazy expiration and worker tests                                 |
| Valid state transitions                       | [x]    | All 36 state-pair unit cases                                              |
| Cancellation restores inventory               | [x]    | Reserved and paid cancellation, including concurrent repeats              |
| Database transactions                         | [x]    | Shared Prisma interactive transaction helper                              |
| Rollback safety                               | [x]    | Database-trigger failure injection                                        |
| Input validation                              | [x]    | Strict Zod validation and API tests                                       |
| Security middleware                           | [x]    | Helmet, CORS, limits, error handling, staff-key tests                     |
| Environment variable protection               | [x]    | Ignored environment files, Docker exclusions, no secret VITE settings     |
| Concurrency tests                             | [x]    | Dedicated concurrency directory                                           |
| Payment idempotency tests                     | [x]    | Same/different keys, payload mismatch, cross-order reuse                  |
| Expiration race tests                         | [x]    | Expired and near-boundary races; lock-wait regression                     |
| Docker support                                | [x]    | Built images and healthy Compose services                                 |
| README documentation                          | [x]    | Setup, API, lifecycle, security, diagrams, limitations                    |
| Production build succeeds                     | [x]    | Local and Docker production builds                                        |
| Public deployment configuration ready         | [x]    | Independent containers/static build, SSL/pool/health/migration guidance   |

## Pending external verification

- [ ] Final browser inspection of the **Docker-served** frontend at http://localhost:8080. Automatic approval review blocked this navigation, first citing an account usage limit and then retaining the previous block. No alternative browser route was used to bypass it. Container build and health checks passed.
- [ ] Actual public deployment and public-URL verification. No cloud hosting account, managed PostgreSQL credentials or domain was provided. Configuration is ready; publishing is not claimed.
- [ ] Execute the committed GitHub Actions workflow on a remote repository. Equivalent local checks passed, but no remote CI run is claimed.

## Reproduce the checks

```sh
npm ci
npm run setup
docker compose up -d --wait db
npm run db:generate
npm run db:migrate
docker compose exec -T db createdb -U pos pos_test
npm run db:test:migrate
npm run db:seed
npm test
npm run test:db
npm run lint
npm run format:check
npm run build
npm audit
```

The test database must end in _test and is emptied between cases. Running createdb is needed only once. The application's development database is separate and remains intact.

These results demonstrate the tested scenarios and database invariants; they do not substitute for workload-specific load testing or a security review for real retail use. The application is a shared synthetic-data assessment sandbox with a mock gateway.
