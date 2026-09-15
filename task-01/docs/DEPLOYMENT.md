# Deployment

The application supports separate static frontend, Node API and PostgreSQL services. The repository contains runnable Docker images, Compose configuration, migrations and health checks. No public deployment has been made: no hosting account, domain or managed database was supplied.

## Container deployment

1. Provision PostgreSQL and a secret DATABASE_URL. Use a dedicated database/user with the required schema permissions.
2. Build backend/Dockerfile from the repository root.
3. Set PORT, NODE_ENV=production, FRONTEND_URL, DATABASE_URL and a randomly generated ADMIN_API_KEY of at least 32 characters. Keep the key server-side and share it only with assessment staff.
4. Start the container. Its entrypoint runs Prisma migrate deploy before the API starts. For larger deployments, execute migrations in one release job and use node src/server.js as the application command.
5. Optionally run node prisma/seed.js once. Repeating it does not reset stock.
6. Build frontend/Dockerfile with VITE_API_URL set to the public HTTPS API URL ending in /api. Set VITE_CURRENCY to the single display currency.
7. Set the frontend runtime PORT for Nginx. Point the platform health check to / and the API health check to /api/health.
8. Set FRONTEND_URL to the frontend's exact HTTPS origin. Configure TRUST_PROXY to the actual number of trusted reverse-proxy hops.
9. Verify the site with a mock checkout, each mock payment outcome and a cancellation. Test PostgreSQL concurrency against a separate disposable database.

Use a persistent, always-running API process for the expiration worker. Request-only/serverless runtimes need a separate scheduled worker. Multiple long-running API instances can each run the worker safely.

## Static-host deployment

Build the frontend with npm ci and npm run build -w frontend. Publish frontend/dist and configure a rewrite of non-file routes to /index.html so /products and /orders/:id survive direct navigation. VITE_API_URL is a build-time public value; changing it requires a rebuild.

The Express API does not serve the React bundle and can be deployed independently.

## PostgreSQL SSL and pooling

Use the provider's complete connection URL, including its required sslmode and CA settings. Do not disable certificate verification as a workaround. Set connection_limit and pool_timeout in the Prisma connection URL based on the provider's connection budget and the number of application instances.

The application uses one shared PrismaClient per process. Transaction-scoped advisory locks and row locks require a connection to remain pinned for the transaction; use a transaction-compatible pooler or direct database connection. Schema migrations may require the provider's direct connection endpoint.

Reserve connections for administration and migrations. Configure provider backups and test recovery before using real data.

## Docker Compose verification

The current workspace generated local database credentials in ignored .env files. Container verification uses API port 4001 and frontend port 8080 to coexist with the development API at 4000.

PowerShell:

```powershell
$env:API_PORT = '4001'
$env:PUBLIC_API_URL = 'http://localhost:4001/api'
docker compose --profile app up -d --build --wait
```

POSIX shell:

```sh
API_PORT=4001 PUBLIC_API_URL=http://localhost:4001/api docker compose --profile app up -d --build --wait
```

The root .env.example defaults to API port 4000. Keep API_PORT and PUBLIC_API_URL consistent when selecting another port. FRONTEND_URL defaults to the Compose frontend's origin. PostgreSQL publishes only on the loopback interface for local development.

To inspect status, use docker compose --profile app ps. To stop project services, use docker compose --profile app down. Persistent database storage remains unless explicitly removed.

## Operational behavior

- A failing database health query returns 503 with a safe error.
- Startup fails rather than serving requests without a database.
- Shutdown stops accepting HTTP traffic, drains requests and worker activity, then disconnects Prisma.
- Shutdown has a 25-second deadline; unfinished transactions are rolled back if the process exits.
- A worker batch error is logged and retried at the next interval.
- Every instance may run expiry; order locks make restoration idempotent.
- No frontend countdown authorizes payment.
- Public demo order/cart APIs are intentionally shared. Real customer data requires identity, ownership checks, staff roles and a real payment provider.

## Release verification

Run the complete checks from README before deployment. Verify /api/health externally, exact CORS configuration, route refreshes, rate-limit behavior behind the configured proxy, and container restart recovery. Use synthetic data for the assessment.

Cloud account provisioning, a public domain/URL, HTTPS routing and managed database credentials remain environment-specific deployment steps.
