import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_router import router as auth_router
from app.db.base import engine, Base

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Auto-seed if the DB is empty
    await _auto_seed()
    yield


async def _auto_seed():
    """Seed default users on first boot (skips if users already exist)."""
    from app.db.base import AsyncSessionLocal
    from app.models.user import User, UserRole
    from app.services.auth_service import hash_password
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            logging.info("Users table already has data — skipping seed.")
            return

        SEED_USERS = [
            {"name": "System Admin",        "email": "admin@erp.gh",   "role": UserRole.system_admin,     "org": None},
            {"name": "Korle Bu Hospital",   "email": "korlebu@erp.gh", "role": UserRole.hospital_admin,   "org": "korlebu"},
            {"name": "Accra Police HQ",     "email": "police@erp.gh",  "role": UserRole.police_admin,     "org": "accra_police"},
            {"name": "Ghana Fire HQ",       "email": "fire@erp.gh",    "role": UserRole.fire_admin,       "org": "ghana_fire"},
            {"name": "Driver Kwame Asante", "email": "driver1@erp.gh", "role": UserRole.ambulance_driver, "org": "korlebu"},
            {"name": "Driver Ama Mensah",   "email": "driver2@erp.gh", "role": UserRole.ambulance_driver, "org": "ridge_hosp"},
        ]
        for u in SEED_USERS:
            db.add(User(
                id=str(uuid.uuid4()),
                name=u["name"], email=u["email"],
                password_hash=hash_password("password123"),
                role=u["role"], organization_id=u["org"],
            ))
        await db.commit()
        logging.info(f"Auto-seeded {len(SEED_USERS)} users.")


app = FastAPI(
    title="Auth Service",
    version="1.0.0",
    docs_url="/auth/docs",
    openapi_url="/auth/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth_service"}