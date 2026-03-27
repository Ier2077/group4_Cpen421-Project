"""
Seeds vehicles (ambulances, police cars, fire trucks) with Accra coordinates.
Run: docker exec -it dispatch_service python scripts/seed.py
"""
import asyncio
import sys
import os

sys.path.insert(0, "/app")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://erp_user:erp_pass@dispatch_db:5432/dispatch_db")

from app.db.base import engine, Base, AsyncSessionLocal
from app.models.vehicle import Vehicle, ServiceType, VehicleStatus
import uuid


VEHICLES = [
    # Ambulances
    {"type": ServiceType.ambulance, "org": "korlebu",     "plate": "GR-AMB-001", "name": "Kwame Asante",  "lat": 5.5390, "lon": -0.2274},
    {"type": ServiceType.ambulance, "org": "ridge_hosp",  "plate": "GR-AMB-002", "name": "Ama Mensah",    "lat": 5.5717, "lon": -0.1887},
    {"type": ServiceType.ambulance, "org": "37mil",       "plate": "GR-AMB-003", "name": "Kofi Boateng",  "lat": 5.6037, "lon": -0.1870},
    {"type": ServiceType.ambulance, "org": "tema_hosp",   "plate": "GR-AMB-004", "name": "Akua Darko",    "lat": 5.6698, "lon": -0.0166},

    # Police vehicles
    {"type": ServiceType.police,   "org": "accra_police", "plate": "GR-POL-001", "name": "Sgt Mensah",    "lat": 5.5601, "lon": -0.2057},
    {"type": ServiceType.police,   "org": "accra_police", "plate": "GR-POL-002", "name": "Sgt Asare",     "lat": 5.5750, "lon": -0.2300},
    {"type": ServiceType.police,   "org": "tema_police",  "plate": "GR-POL-003", "name": "Cpl Darko",     "lat": 5.6812, "lon": -0.0063},
    {"type": ServiceType.police,   "org": "accra_police", "plate": "GR-POL-004", "name": "Cpl Owusu",     "lat": 5.5489, "lon": -0.1960},

    # Fire trucks
    {"type": ServiceType.fire,     "org": "ghana_fire",   "plate": "GR-FIR-001", "name": "Off. Nkrumah",  "lat": 5.5560, "lon": -0.1966},
    {"type": ServiceType.fire,     "org": "ghana_fire",   "plate": "GR-FIR-002", "name": "Off. Agyemang", "lat": 5.6100, "lon": -0.1733},
    {"type": ServiceType.fire,     "org": "ghana_fire",   "plate": "GR-FIR-003", "name": "Off. Boakye",   "lat": 5.6600, "lon": -0.0220},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for v in VEHICLES:
            vehicle = Vehicle(
                id=str(uuid.uuid4()),
                service_type=v["type"],
                organization_id=v["org"],
                plate_number=v["plate"],
                assigned_personnel_name=v["name"],
                latitude=v["lat"],
                longitude=v["lon"],
                vehicle_status=VehicleStatus.available,
                is_available=True,
            )
            db.add(vehicle)
        await db.commit()
        print(f"Seeded {len(VEHICLES)} vehicles.")


asyncio.run(seed())