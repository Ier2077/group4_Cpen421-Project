# Deploying to Render (Free Tier) + CloudAMQP

This guide walks you through hosting the Emergency Response Platform for free using Render and CloudAMQP.

## Architecture on Render

```
                          ┌──────────────────┐
                          │    Frontend      │
                          │  (Vercel/Render) │
                          └────────┬─────────┘
                                   │  all requests
                                   ▼
                          ┌──────────────────┐
                          │   API Gateway    │
                          │   (Render Free)  │
                          │  ONE public URL  │
                          └──┬───┬───┬───┬───┘
            ┌────────────────┘   │   │   └────────────────┐
            ▼                    ▼   ▼                    ▼
   ┌────────────────┐  ┌──────────┐ ┌──────────┐  ┌──────────────┐
   │ Auth Service   │  │ Incident │ │ Dispatch │  │  Analytics   │
   │ (Render Free)  │  │ Service  │ │ Service  │  │  Service     │
   └───────┬────────┘  └────┬─────┘ └──┬───────┘  └──────┬───────┘
           │                │          │                  │
           └────────┬───────┴──────────┼──────────────────┘
                    │                  │
           ┌────────┴───────┐   ┌──────┴───────┐
           │ Render         │   │ Render Redis │
           │ PostgreSQL     │   │ (Free)       │
           │ (Free/shared)  │   └──────────────┘
           └────────┬───────┘
                    │
           ┌────────┴───────┐
           │  CloudAMQP     │
           │  RabbitMQ      │
           │  (Free)        │
           └────────────────┘
```

The gateway replaces Nginx — your frontend talks to ONE URL and the gateway
routes `/auth/*`, `/incidents/*`, `/vehicles/*`, `/analytics/*` to the right service.


## Step 1: Set Up CloudAMQP (Free RabbitMQ)

1. Go to [cloudamqp.com](https://www.cloudamqp.com/) and sign up
2. Create a new instance:
   - **Plan**: Little Lemur (Free)
   - **Name**: `erp-rabbitmq`
   - **Region**: Pick the closest to you
3. Copy the **AMQP URL** — looks like:
   ```
   amqps://username:password@rattlesnake.rmq.cloudamqp.com/username
   ```
4. Save this — you'll need it in Step 3


## Step 2: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/emergency-response-platform.git
git push -u origin main
```


## Step 3: Deploy on Render

### Option A: Blueprint (recommended)

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New" → "Blueprint"**
3. Connect your GitHub repo
4. Render detects `render.yaml` and creates everything automatically
5. After deploy, go to **each service's Environment tab** and fill in:

   **On all 4 backend services:**
   - `RABBITMQ_URL` → your CloudAMQP URL from Step 1

   **On erp-incident-service:**
   - `DISPATCH_SERVICE_URL` → `https://erp-dispatch-service.onrender.com`

   **On erp-gateway:**
   - `AUTH_SERVICE_URL` → `https://erp-auth-service.onrender.com`
   - `INCIDENT_SERVICE_URL` → `https://erp-incident-service.onrender.com`
   - `DISPATCH_SERVICE_URL` → `https://erp-dispatch-service.onrender.com`
   - `ANALYTICS_SERVICE_URL` → `https://erp-analytics-service.onrender.com`
   - `ALLOWED_ORIGINS` → `*` (or your frontend URL later)

### Option B: Manual setup

If the blueprint doesn't work, create services manually:

1. **Create PostgreSQL** → New → PostgreSQL → Free tier → name: `erp-database`
2. **Create Redis** → New → Redis → Free tier
3. **Create 5 Web Services** (auth, incident, dispatch, analytics, gateway):
   - Runtime: **Docker**
   - Plan: **Free**
   - Docker context: `.` (root of repo — important!)
   - Dockerfile path: `services/<service_name>/Dockerfile`
   - Set environment variables as described above
   - `DATABASE_URL` = Postgres connection string (not needed for gateway)
   - `JWT_SECRET` = same random string for all 4 backend services


## Step 4: Seed the Database

After all services are running:

1. Go to **erp-auth-service** on Render → **Shell** tab → run `python scripts/seed.py`
2. Go to **erp-dispatch-service** → Shell → `python scripts/seed.py`
3. Go to **erp-incident-service** → Shell → `python scripts/seed.py`


## Step 5: Test It

Everything goes through the gateway:

```bash
# Health check
curl https://erp-gateway.onrender.com/health

# Login
curl -X POST https://erp-gateway.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@erp.gh", "password": "password123"}'

# List open incidents (use the access_token from login)
curl https://erp-gateway.onrender.com/incidents/open \
  -H "Authorization: Bearer YOUR_TOKEN"

# List vehicles
curl https://erp-gateway.onrender.com/vehicles \
  -H "Authorization: Bearer YOUR_TOKEN"
```

API docs are at: `https://erp-gateway.onrender.com/docs` (gateway),
or directly on each service at `/auth/docs`, `/incidents/docs`, etc.


## Step 6: Connect the Frontend

Your frontend only needs ONE URL — the gateway.

**frontend/.env.development** (local dev with Docker Compose):
```
VITE_API_BASE_URL=http://localhost:80
```

**frontend/.env.production** (deployed on Render/Vercel):
```
VITE_API_BASE_URL=https://erp-gateway.onrender.com
```

**frontend/src/api/client.ts:**
```typescript
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:80';
```

Then all API calls use the same base:
```typescript
fetch(`${API_BASE}/auth/login`, { ... })
fetch(`${API_BASE}/incidents/open`, { ... })
fetch(`${API_BASE}/vehicles`, { ... })
```

Routes stay identical in both environments because the gateway routes
`/auth/*`, `/incidents/*`, `/vehicles/*`, `/analytics/*` just like Nginx does locally.


## Step 7: Deploy the Frontend

**Option A: Vercel (easiest for Vite/React)**
1. Push `frontend/` to GitHub
2. Connect to Vercel → auto-detects Vite
3. Add env variable: `VITE_API_BASE_URL` = `https://erp-gateway.onrender.com`

**Option B: Render Static Site**
1. Dashboard → New → Static Site
2. Build command: `cd frontend && npm install && npm run build`
3. Publish directory: `frontend/dist`
4. Add env variable: `VITE_API_BASE_URL` = `https://erp-gateway.onrender.com`


## Important Notes

### Free Tier Limitations
- **Cold starts**: Services spin down after 15 min of inactivity → ~30-50s first request
- **PostgreSQL**: Free tier expires after 90 days — recreate when needed
- **Redis**: 25MB limit (plenty for this)
- **CloudAMQP**: Max 20 connections, 1M messages/month (plenty for demo)
- **Cold start chain**: First request hits gateway → gateway hits backend → backend connects to DB. Can take up to ~1-2 min if everything is cold. Subsequent requests are fast.

### Shared Database
All 4 services share one Postgres. Tables don't conflict:
- Auth: `users`, `refresh_tokens`
- Incident: `incidents`, `hospitals`
- Dispatch: `vehicles`
- Analytics: `incident_records`, `vehicle_deployments`

### Local Development Still Works
`docker-compose.yml` is untouched — `docker compose up` works as before.
Locally you use Nginx on port 80. On Render, the gateway does the same job.
All changes are backwards-compatible.
