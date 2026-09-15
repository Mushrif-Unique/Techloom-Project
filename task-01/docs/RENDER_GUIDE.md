# Deploy task-01 to Render

Use three services: a Render Static Site for React, a Docker Web Service for Express, and managed Render PostgreSQL. Docker Compose is for local development; Render will build the backend Dockerfile directly.

## 1. Prepare the repository

Create an empty GitHub repository named task-01. Do not initialize it with a README if you are pushing this existing project.

Open PowerShell in the project directory:

```powershell
cd "C:\Users\MUSHR\Desktop\Techloom Project\task-01"
git init
git add .
git status
git commit -m "Initial POS order and inventory system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/task-01.git
git push -u origin main
```

Replace YOUR_USERNAME with your account name. If the folder is already a Git repository, inspect git status and git remote -v before reusing initialization/remote commands. Confirm no .env files or node_modules are staged. Keep package-lock.json and the .env.example templates.

Sign in to Render and connect the GitHub repository. Render may request access to this repository.

## 2. Create PostgreSQL

In Render, select New > Postgres.

- Name: task-01-db (suggested).
- Select a region and keep the backend in the same region.
- Choose a database plan suitable for the lifetime of the assessment.
- Wait until the database is available.
- Copy its Internal Database URL from Connect. Treat it as a password.

There is no separate PostgreSQL website account to create. Render provisions a database user and password. An external connection URL is only needed for access from your computer; use the internal URL for the hosted backend.

The new database starts empty. Migrations create its tables and the seed adds example products. Existing local orders do not automatically transfer.

## 3. Create the frontend Static Site

Create New > Static Site from the task-01 repository.

| Setting           | Value                                  |
| ----------------- | -------------------------------------- |
| Name              | task-01-web, or another available name |
| Branch            | main                                   |
| Root Directory    | Leave blank: repository root           |
| Build Command     | npm ci && npm run build -w frontend    |
| Publish Directory | frontend/dist                          |

Set build environment variables:

| Variable      | Value                                   |
| ------------- | --------------------------------------- |
| NODE_VERSION  | 22.16.0                                 |
| VITE_API_URL  | https://example.invalid/api temporarily |
| VITE_CURRENCY | USD                                     |

Deploy once to obtain the actual frontend URL. The temporary API value allows the static build but data requests will not work yet. Replace it in step 6.

Under Redirects/Rewrites add:

| Source | Destination | Action  |
| ------ | ----------- | ------- |
| /*     | /index.html | Rewrite |

This makes direct navigation and refresh on /products and /orders/:id work.

## 4. Generate a staff key locally

Run:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Save the resulting secret in your password manager. Enter it into Render's backend environment settings in the next step. Do not place it in GitHub or a VITE variable.

This is a shared staff key, not an individual login account. The application has no user registration. Product mutations require this key in production; cart/order demo endpoints are public.

## 5. Create the backend Docker Web Service

Create New > Web Service from the same repository.

| Setting              | Value                                  |
| -------------------- | -------------------------------------- |
| Name                 | task-01-api, or another available name |
| Language / Runtime   | Docker                                 |
| Branch               | main                                   |
| Region               | Same as the database                   |
| Root Directory       | Leave blank                            |
| Dockerfile Path      | backend/Dockerfile                     |
| Docker Build Context | . (repository root)                    |
| Docker Command       | Leave blank; use the Dockerfile CMD    |
| Health Check Path    | /api/health                            |

Do not set Root Directory to backend: the Dockerfile needs the root package-lock.json and both workspace package manifests.

Set backend environment variables:

| Variable           | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| DATABASE_URL       | Your Render Internal Database URL                                  |
| NODE_ENV           | production                                                         |
| PORT               | 10000                                                              |
| FRONTEND_URL       | The exact HTTPS frontend URL from step 3, without a trailing slash |
| ADMIN_API_KEY      | The generated staff key                                            |
| EXPIRY_INTERVAL_MS | 15000                                                              |
| RATE_LIMIT_MAX     | 300                                                                |
| LOG_LEVEL          | info                                                               |

Configure TRUST_PROXY to the trusted reverse-proxy hop count for your deployment. The default is 0; behind a proxy this can group visitors into one rate-limit bucket. Verify the proxy topology before increasing trust rather than trusting arbitrary forwarded headers.

For this small assessment, a connection_limit of 10 and pool_timeout of 20 are reasonable starting points, subject to your database plan and number of API instances. Append them to DATABASE_URL with ? if there is no query string, or & if a query string already exists. Preserve provider-required SSL settings. Use the direct internal database URL, not a pooler URL, for this initial deployment because startup also runs migrations.

Choose an always-running backend plan for reliable periodic cleanup. The worker runs inside the API process, and a sleeping service does not run periodic jobs.

Deploy. The Dockerfile applies Prisma migrations and then starts the API automatically. Open the actual API URL followed by /api/health and check for:

```json
{ "success": true, "data": { "status": "ok", "database": "connected" } }
```

If deployment fails, read the backend logs. Check DATABASE_URL, region, FRONTEND_URL format, the staff key length, and the Docker build context.

## 6. Connect the frontend to the backend

In the Static Site environment settings, replace VITE_API_URL with:

```text
https://YOUR-ACTUAL-BACKEND-DOMAIN/api
```

Trigger a fresh frontend build/deploy. Vite embeds this public URL at build time; changing it without rebuilding does not update the downloaded JavaScript.

Make sure backend FRONTEND_URL matches the actual frontend origin exactly. Update and redeploy the backend if necessary.

Never set VITE_API_URL to localhost in a public deployment. Never set VITE_DATABASE_URL or VITE_ADMIN_API_KEY.

## 7. Add sample products

In the backend service Shell, if your selected plan provides it, run:

```sh
node prisma/seed.js
```

The backend image's working directory is /app/backend. The seed inserts six products and preserves products/stock that already exist.

If your plan does not provide a service shell, open the frontend, enter the staff key in Staff access settings, and use Add product to create products through the UI. A database seed is optional.

## 8. Verify the demo

- Open the deployed frontend.
- Enter the staff key and create/edit a test product.
- Add products to a cart and change quantities.
- Checkout and verify the five-minute reservation.
- Simulate success: order PAID; inventory not deducted a second time.
- Use new carts to test failure and timeout: inventory restored.
- Cancel a paid order: simulated refund and inventory restored once.
- Leave a reservation unpaid: it becomes EXPIRED after processing.
- Refresh /products and an order-detail URL directly.
- Check backend logs and /api/health.

Use synthetic assessment data. This is not an authenticated multi-user store: customers do not have individual accounts, and public order actions are intentionally available for the demo.

## Local Docker after the rename

The Compose file pins its project name to posorderinventorysystem, preserving the existing local database volume despite the folder rename. The npm project name is task-01; the UI product remains Counter.

```powershell
cd "C:\Users\MUSHR\Desktop\Techloom Project\task-01"
docker compose up -d --wait db
npm.cmd run dev
```

## Cost and lifecycle

Review Render's current plans before creating services. Free web services sleep after inactivity, and free PostgreSQL has a limited lifetime. Docker does not override these limits.

## Official references

- [Docker deployment](https://render.com/docs/docker)
- [PostgreSQL creation and internal/external connections](https://render.com/docs/postgresql-creating-connecting)
- [Static-site routing](https://render.com/docs/redirects-rewrites)
- [Health checks](https://render.com/docs/health-checks)
- [Free-service limitations](https://render.com/docs/free)
