import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.vehicle_router import router as vehicle_router
from app.db.base import engine, Base
from app.events.consumer import consumer, handle_event
from shared.rabbitmq import publisher

logging.basicConfig(
    stream=sys.stdout, level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _auto_seed()
    await publisher.connect()
    asyncio.create_task(consumer.start(handle_event))
    yield
    await publisher.close()
    await consumer.close()


async def _auto_seed():
    """Seed vehicles on first boot (skips if vehicles already exist)."""
    from app.db.base import AsyncSessionLocal
    from app.models.vehicle import Vehicle, ServiceType, VehicleStatus
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Vehicle).limit(1))
        if result.scalar_one_or_none():
            logging.info("Vehicles table already has data — skipping seed.")
            return

        VEHICLES = [
            {"type": ServiceType.ambulance, "org": "korlebu",     "plate": "GR-AMB-001", "name": "Kwame Asante",  "lat": 5.5390, "lon": -0.2274},
            {"type": ServiceType.ambulance, "org": "ridge_hosp",  "plate": "GR-AMB-002", "name": "Ama Mensah",    "lat": 5.5717, "lon": -0.1887},
            {"type": ServiceType.ambulance, "org": "37mil",       "plate": "GR-AMB-003", "name": "Kofi Boateng",  "lat": 5.6037, "lon": -0.1870},
            {"type": ServiceType.ambulance, "org": "tema_hosp",   "plate": "GR-AMB-004", "name": "Akua Darko",    "lat": 5.6698, "lon": -0.0166},
            {"type": ServiceType.police,    "org": "accra_police", "plate": "GR-POL-001", "name": "Sgt Mensah",   "lat": 5.5601, "lon": -0.2057},
            {"type": ServiceType.police,    "org": "accra_police", "plate": "GR-POL-002", "name": "Sgt Asare",    "lat": 5.5750, "lon": -0.2300},
            {"type": ServiceType.police,    "org": "tema_police",  "plate": "GR-POL-003", "name": "Cpl Darko",    "lat": 5.6812, "lon": -0.0063},
            {"type": ServiceType.police,    "org": "accra_police", "plate": "GR-POL-004", "name": "Cpl Owusu",    "lat": 5.5489, "lon": -0.1960},
            {"type": ServiceType.fire,      "org": "ghana_fire",   "plate": "GR-FIR-001", "name": "Off. Nkrumah", "lat": 5.5560, "lon": -0.1966},
            {"type": ServiceType.fire,      "org": "ghana_fire",   "plate": "GR-FIR-002", "name": "Off. Agyemang","lat": 5.6100, "lon": -0.1733},
            {"type": ServiceType.fire,      "org": "ghana_fire",   "plate": "GR-FIR-003", "name": "Off. Boakye",  "lat": 5.6600, "lon": -0.0220},
        ]
        for v in VEHICLES:
            db.add(Vehicle(
                id=str(uuid.uuid4()),
                service_type=v["type"], organization_id=v["org"],
                plate_number=v["plate"], assigned_personnel_name=v["name"],
                latitude=v["lat"], longitude=v["lon"],
                vehicle_status=VehicleStatus.available, is_available=True,
            ))
        await db.commit()
        logging.info(f"Auto-seeded {len(VEHICLES)} vehicles.")


app = FastAPI(
    title="Dispatch Tracking Service",
    version="1.0.0",
    docs_url="/vehicles/docs",
    openapi_url="/vehicles/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(vehicle_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "dispatch_service"}