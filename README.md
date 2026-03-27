# Ghana Emergency Response & Dispatch Platform

A distributed, microservices-based emergency response and dispatch coordination platform
built with FastAPI, PostgreSQL, RabbitMQ, Redis, and Docker.

## Architecture

| Service | Port | Database | Description |
|---|---|---|---|
| auth_service | 8001 | auth_db | JWT auth, user management |
| incident_service | 8002 | incident_db | Incident creation & auto-dispatch |
| dispatch_service | 8003 | dispatch_db | Vehicle tracking, WebSockets |
| analytics_service | 8004 | analytics_db | Event-driven analytics |
| RabbitMQ | 5672 / 15672 | — | Async event bus |
| Redis | 6379 | — | Ephemeral location cache |
| nginx | 80 | — | Reverse proxy |

## Prerequisites

- Docker 24+
- Docker Compose v2+

## Quick Start

### 1. Clone and configure
```bash
git clone <repo>
cd emergency-response-platform
cp .env.example .env
# Edit .env if needed (change JWT_SECRET for production!)
```

### 2. Start all services
```bash
docker compose up --build -d
```

Wait ~30 seconds for all services to become healthy.

### 3. Seed data
```bash
# Seed users
docker exec -it auth_service python scripts/seed.py

# Seed hospitals
docker exec -it incident_service python scripts/seed.py

# Seed vehicles
docker exec -it dispatch_service python scripts/seed.py
```

### 4. Access API docs

| Service | Swagger UI |
|---|---|
| Auth | http://localhost:8001/auth/docs |
| Incidents | http://localhost:8002/incidents/docs |
| Dispatch | http://localhost:8003/vehicles/docs |
| Analytics | http://localhost:8004/analytics/docs |
| RabbitMQ UI | http://localhost:15672 (guest/guest) |

## API Walkthrough

### Login
```bash
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@erp.gh","password":"password123"}'
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Create Incident
```bash
TOKEN="<access_token_from_login>"

curl -X POST http://localhost:8002/incidents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "citizen_name": "Akua Sarpong",
    "incident_type": "medical",
    "latitude": 5.5601,
    "longitude": -0.2057,
    "notes": "Unconscious person at junction"
  }'
```

The system will automatically:
1. Compute the region (Greater Accra)
2. Find the nearest available ambulance
3. Find the nearest hospital with available beds
4. Assign the vehicle and hospital
5. Return the incident in DISPATCHED status
6. Publish events to RabbitMQ

### Track Vehicle via WebSocket
```javascript
const ws = new WebSocket("ws://localhost:8003/vehicles/ws/incident/<incident_id>");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

### Update Vehicle Location (as driver)
```bash
DRIVER_TOKEN="<ambulance_driver_token>"
VEHICLE_ID="<vehicle_id>"

curl -X POST http://localhost:8003/vehicles/$VEHICLE_ID/location \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude": 5.5650, "longitude": -0.2100}'
```

### Get Analytics
```bash
curl http://localhost:8004/analytics/response-times \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:8004/analytics/incidents-by-region \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:8004/analytics/resource-utilization \
  -H "Authorization: Bearer $TOKEN"
```

## Running Tests
```bash
# Auth service tests
docker exec -it auth_service pytest tests/ -v

# Dispatch service tests
docker exec -it dispatch_service pytest tests/ -v

# Incident service tests
docker exec -it incident_service pytest tests/ -v
```

## Seed Credentials

| Name | Email | Password | Role |
|---|---|---|---|
| System Admin | admin@erp.gh | password123 | system_admin |
| Korle Bu Hospital | korlebu@erp.gh | password123 | hospital_admin |
| Accra Police HQ | police@erp.gh | password123 | police_admin |
| Ghana Fire HQ | fire@erp.gh | password123 | fire_admin |
| Driver Kwame Asante | driver1@erp.gh | password123 | ambulance_driver |
| Driver Ama Mensah | driver2@erp.gh | password123 | ambulance_driver |

## Authorization Matrix

| Endpoint | system_admin | hospital_admin | police_admin | fire_admin | ambulance_driver |
|---|---|---|---|---|---|
| POST /auth/register | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST /incidents | ✓ | | | | |
| GET /incidents/open | ✓ | ✓ | ✓ | ✓ | |
| PUT /incidents/{id}/status | ✓ | ✓ | ✓ | ✓ | |
| POST /vehicles/register | ✓ | ✓ | ✓ | ✓ | |
| POST /vehicles/{id}/location | ✓ | | | | ✓ |
| GET /analytics/* | ✓ | ✓ | ✓ | ✓ | |

## RabbitMQ Events

| Routing Key | Published By | Consumed By |
|---|---|---|
| incident.created | incident_service | analytics_service |
| incident.assigned | incident_service | analytics_service, dispatch_service |
| incident.status_updated | incident_service | analytics_service |
| incident.resolved | incident_service | analytics_service, dispatch_service |
| vehicle.registered | dispatch_service | analytics_service |
| vehicle.location_updated | dispatch_service | analytics_service |
| vehicle.assigned | dispatch_service | analytics_service |
| vehicle.released | dispatch_service | analytics_service |

## Design Decisions & Simplifications

- **Hospital data** is seeded into `incident_db` — no separate hospital microservice needed
- **Region bucketing** uses bounding-box coordinates for Ghana's regions instead of a geocoding API
- **Nearest-unit selection** uses the Haversine formula (great-circle distance in km)
- **JWT verification** happens in each service using the shared `JWT_SECRET` — no token introspection calls needed
- **WebSocket auth** is currently open for simplicity; add token query-param validation for production
- **Bed reservation** decrements `available_beds` at dispatch time; increment on resolution requires an additional event (extend as needed)
- All times are UTC

## Stopping the Platform
```bash
docker compose down          # stops containers
docker compose down -v       # stops and removes volumes (data loss!)
```