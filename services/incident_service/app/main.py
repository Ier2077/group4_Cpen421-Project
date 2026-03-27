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
    await publisher.connect()
    yield
    await publisher.close()


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