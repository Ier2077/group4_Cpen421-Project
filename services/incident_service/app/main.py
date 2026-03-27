import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.incident_router import router as incident_router
from app.db.base import engine, Base
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
    yield
    await publisher.close()


async def _auto_seed():
    """Seed hospitals on first boot (skips if hospitals already exist)."""
    from app.db.base import AsyncSessionLocal
    from app.models.incident import Hospital
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Hospital).limit(1))
        if result.scalar_one_or_none():
            logging.info("Hospitals table already has data — skipping seed.")
            return

        HOSPITALS = [
            {"name": "Korle Bu Teaching Hospital",  "lat": 5.5390, "lon": -0.2274, "beds": 50, "region": "Greater Accra"},
            {"name": "Ridge Hospital",              "lat": 5.5717, "lon": -0.1887, "beds": 30, "region": "Greater Accra"},
            {"name": "37 Military Hospital",        "lat": 5.6037, "lon": -0.1870, "beds": 40, "region": "Greater Accra"},
            {"name": "Tema General Hospital",       "lat": 5.6698, "lon": -0.0166, "beds": 25, "region": "Greater Accra"},
            {"name": "Komfo Anokye Teaching Hosp",  "lat": 6.6885, "lon": -1.6244, "beds": 60, "region": "Ashanti"},
            {"name": "Cape Coast Teaching Hosp",    "lat": 5.1053, "lon": -1.2466, "beds": 20, "region": "Central"},
        ]
        for h in HOSPITALS:
            db.add(Hospital(
                id=str(uuid.uuid4()),
                name=h["name"], latitude=h["lat"], longitude=h["lon"],
                available_beds=h["beds"], total_beds=h["beds"], region=h["region"],
            ))
        await db.commit()
        logging.info(f"Auto-seeded {len(HOSPITALS)} hospitals.")


app = FastAPI(
    title="Emergency Incident Service",
    version="1.0.0",
    docs_url="/incidents/docs",
    openapi_url="/incidents/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(incident_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "incident_service"}