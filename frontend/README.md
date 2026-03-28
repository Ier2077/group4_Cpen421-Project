# Emergency Response Platform — Frontend

## Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Environment

- `.env.development` → local gateway at `http://localhost:8000`
- `.env.production` → Render gateway at `https://erp-gateway-5t12.onrender.com`

## Default Logins

| Email | Password | Role |
|---|---|---|
| admin@erp.gh | password123 | System Admin |
| korlebu@erp.gh | password123 | Hospital Admin |
| police@erp.gh | password123 | Police Admin |
| fire@erp.gh | password123 | Fire Admin |
| driver1@erp.gh | password123 | Ambulance Driver |

## Pages

- `/login` — Sign in
- `/` — Role-aware dashboard
- `/incidents` — Incident list
- `/incidents/new` — Report incident (system_admin only)
- `/incidents/:id` — Incident detail + status update
- `/vehicles` — Fleet management + location update
- `/tracking` — Live Leaflet map + WebSocket
- `/analytics` — Recharts dashboards
