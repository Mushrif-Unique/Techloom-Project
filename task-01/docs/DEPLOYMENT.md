# Deployment without Docker

Use Node.js 22.12+, a static frontend host, a persistent Node.js API service, and managed PostgreSQL. No public deployment has been made.

For the current Git repository layout, configure Railway and Vercel's root directory as `task-01` (the directory containing this app's package.json). If publishing this folder as its own repository, leave the root directory unset. The Vercel output directory remains `frontend/dist`, relative to that selected root. `vercel.json` supplies the SPA fallback.

## Backend

Run commands from the repository root:

1. Install dependencies: `npm ci --include=dev`.
2. Build: `npm run build -w backend`.
3. Set server environment variables: DATABASE_URL, NODE_ENV=production, PORT, FRONTEND_URL and ADMIN_API_KEY (at least 32 random characters).
4. Apply migrations: `npm run db:migrate`. For multiple API instances, run migrations once per release.
5. Start: `npm run start -w backend`.
6. Optionally seed: `npm run db:seed`. Existing stock is preserved.
7. Configure the health check at /api/health.

Keep database credentials and the staff key server-side. Configure TRUST_PROXY to the actual trusted reverse-proxy hop count. The API must stay running for periodic reservation expiry; sleeping services delay processing until resumed. Request-only hosting needs a separate scheduled worker.

## Frontend

Set VITE_API_URL to the public HTTPS API URL ending in /api, and VITE_CURRENCY to the display currency. Run `npm ci` then `npm run build -w frontend`. Publish frontend/dist. Rewrite non-file routes to /index.html so direct navigation works.

Set backend FRONTEND_URL to the exact frontend HTTPS origin. Rebuild the frontend whenever VITE_API_URL changes. Never put secrets in VITE variables.

## Database

Use the provider's complete PostgreSQL URL and required SSL/CA settings. Use suitable connection_limit and pool_timeout values for the provider's connection budget. Migrations may need a direct endpoint. Transactions need a pinned connection; use a compatible pooler or direct connection.

Native local database commands are for development and CI. Do not use ephemeral cloud storage for database files. Configure managed backups before storing important data.

## Local startup

Run `npm run setup`, `npm run db:start`, `npm run db:migrate` and `npm run dev`. PostgreSQL data persists in .local/postgres/data. Stop it with `npm run db:stop` before moving the project folder.

## Verification

Run the README checks. Verify health, exact CORS origin, direct page refresh, checkout, payment outcomes, cancellation and restart recovery.

The app is a shared synthetic-data assessment with a mock gateway. It has a shared staff key for production product mutations, but no individual user accounts or order ownership checks.
