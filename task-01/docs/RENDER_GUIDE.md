# Optional Render deployment guide

This project uses native Node.js. Confirm Render's account and billing requirements before creating services. No service has been deployed.

## 1. Prepare the repository

Push task-01 to your Git repository. Do not commit .env files, node_modules or .local. Use Node.js 22.12 or newer.

## 2. Create PostgreSQL

Create a managed database and keep its connection URL server-side. Follow provider SSL requirements. Review backups, storage and plan limits.

## 3. Create the frontend Static Site

Select the repository and leave Root Directory blank.

- Build: run npm ci, then npm run build -w frontend.
- Publish directory: frontend/dist.
- Set VITE_CURRENCY=USD.
- Set VITE_API_URL to the eventual public backend URL ending in /api.
- Add a rewrite from /* to /index.html.

Save the frontend HTTPS origin for the backend configuration. If the API URL is not yet known, update it and rebuild once the backend exists.

## 4. Create the backend Web Service

Select Node as the runtime. Leave Root Directory blank.

- Install/build: npm ci --include=dev followed by npm run build -w backend.
- Startup: npm run db:migrate followed by npm run start -w backend. Chain these in the hosting command field using the shell AND operator so startup only proceeds when migrations succeed.
- Health check: /api/health.
- Set DATABASE_URL, NODE_ENV=production, PORT=10000, FRONTEND_URL and ADMIN_API_KEY.
- FRONTEND_URL must match the frontend HTTPS origin exactly.
- Generate a staff key with at least 32 random characters and keep it in server environment settings.
- Configure TRUST_PROXY for the actual trusted proxy hop count.

Keep the API running for scheduled reservation expiry. Sleeping services delay periodic cleanup.

## 5. Connect and verify

Set the frontend VITE_API_URL to the actual API URL and rebuild. Check /api/health, product management with the staff key, carts, checkout, each mock payment outcome, cancellation and direct page refresh.

Optionally run npm run db:seed from the repository root in a service shell. The seed preserves existing stock. You can also create products through the UI.

The staff key is shared; there are no individual user accounts. Use synthetic data for this assessment.

## Local startup

From task-01, run npm run db:start and npm run dev. Local native PostgreSQL is independent of cloud hosting.

See [deployment details](DEPLOYMENT.md) for SSL, pooling and operational guidance.
