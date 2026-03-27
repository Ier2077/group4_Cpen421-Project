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
    await publisher.connect()
    asyncio.create_task(consumer.start(handle_event))
    yield
    await publisher.close()
    await consumer.close()


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