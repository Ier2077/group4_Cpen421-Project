"""
Seeds hospitals and sample incidents.
Run: docker exec -it incident_service python scripts/seed.py
"""
import asyncio
import sys
import os

sys.path.insert(0, "/app")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://erp_user:erp_pass@incident_db:5432/incident_db")

from app.db.base import engine, Base, AsyncSessionLocal
from app.models.incident import Hospital
import uuid


HOSPITALS = [
    {"name": "Korle Bu Teaching Hospital",  "lat": 5.5390, "lon": -0.2274, "beds": 50, "region": "Greater Accra"},
    {"name": "Ridge Hospital",              "lat": 5.5717, "lon": -0.1887, "beds": 30, "region": "Greater Accra"},
    {"name": "37 Military Hospital",        "lat": 5.6037, "lon": -0.1870, "beds": 40, "region": "Greater Accra"},
    {"name": "Tema General Hospital",       "lat": 5.6698, "lon": -0.0166, "beds": 25, "region": "Greater Accra"},
    {"name": "Komfo Anokye Teaching Hosp",  "lat": 6.6885, "lon": -1.6244, "beds": 60, "region": "Ashanti"},
    {"name": "Cape Coast Teaching Hosp",    "lat": 5.1053, "lon": -1.2466, "beds": 20, "region": "Central"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for h in HOSPITALS:
            hospital = Hospital(
                id=str(uuid.uuid4()),
                name=h["name"],
                latitude=h["lat"],
                longitude=h["lon"],
                available_beds=h["beds"],
                total_beds=h["beds"],
                region=h["region"],
            )
            db.add(hospital)
        await db.commit()
        print(f"Seeded {len(HOSPITALS)} hospitals.")


asyncio.run(seed())