"""
Run: docker exec -it auth_service python scripts/seed.py
"""
import asyncio
import sys
import os

sys.path.insert(0, "/app")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://erp_user:erp_pass@auth_db:5432/auth_db")

from app.db.base import engine, Base, AsyncSessionLocal
from app.models.user import User, UserRole
from app.services.auth_service import hash_password
import uuid


SEED_USERS = [
    {"name": "System Admin",        "email": "admin@erp.gh",        "role": UserRole.system_admin,    "org": None},
    {"name": "Korle Bu Hospital",   "email": "korlebu@erp.gh",      "role": UserRole.hospital_admin,  "org": "korlebu"},
    {"name": "Accra Police HQ",     "email": "police@erp.gh",       "role": UserRole.police_admin,    "org": "accra_police"},
    {"name": "Ghana Fire HQ",       "email": "fire@erp.gh",         "role": UserRole.fire_admin,      "org": "ghana_fire"},
    {"name": "Driver Kwame Asante", "email": "driver1@erp.gh",      "role": UserRole.ambulance_driver,"org": "korlebu"},
    {"name": "Driver Ama Mensah",   "email": "driver2@erp.gh",      "role": UserRole.ambulance_driver,"org": "ridge_hosp"},
]

DEFAULT_PASSWORD = "password123"


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for u in SEED_USERS:
            user = User(
                id=str(uuid.uuid4()),
                name=u["name"],
                email=u["email"],
                password_hash=hash_password(DEFAULT_PASSWORD),
                role=u["role"],
                organization_id=u["org"],
            )
            db.add(user)
        await db.commit()
        print(f"Seeded {len(SEED_USERS)} users. Default password: {DEFAULT_PASSWORD}")


asyncio.run(seed())