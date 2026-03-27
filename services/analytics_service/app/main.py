import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analytics_router import router as analytics_router
from app.db.base import engine, Base
from app.events.consumer import consumer, handle_event

logging.basicConfig(
    stream=sys.stdout, level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    asyncio.create_task(consumer.start(handle_event))
    yield
    await consumer.close()


app = FastAPI(
    title="Analytics & Monitoring Service",
    version="1.0.0",
    docs_url="/analytics/docs",
    openapi_url="/analytics/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(analytics_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics_service"}