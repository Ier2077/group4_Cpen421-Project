import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base, get_db
from shared.jwt_utils import create_access_token

TEST_DB = "sqlite+aiosqlite:///./test_incident.db"
test_engine = create_async_engine(TEST_DB, connect_args={"check_same_thread": False})
TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def admin_token():
    return create_access_token({"sub": "admin-id", "role": "system_admin", "email": "admin@test.gh"})


@pytest.mark.anyio
async def test_create_incident():
    with (
        patch("shared.rabbitmq.publisher.publish", new_callable=AsyncMock),
        patch("app.services.incident_service.get_available_vehicles", new_callable=AsyncMock, return_value=[]),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {admin_token()}"}
            resp = await client.post("/incidents", json={
                "citizen_name": "Kofi Test",
                "incident_type": "fire",
                "latitude": 5.56,
                "longitude": -0.20,
                "notes": "Building on fire",
            }, headers=headers)
            assert resp.status_code == 201
            data = resp.json()
            assert data["citizen_name"] == "Kofi Test"
            assert data["status"] == "CREATED"
            assert data["region"] is not None


@pytest.mark.anyio
async def test_get_open_incidents():
    with (
        patch("shared.rabbitmq.publisher.publish", new_callable=AsyncMock),
        patch("app.services.incident_service.get_available_vehicles", new_callable=AsyncMock, return_value=[]),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {admin_token()}"}
            await client.post("/incidents", json={
                "citizen_name": "Test Person",
                "incident_type": "crime",
                "latitude": 5.55,
                "longitude": -0.19,
            }, headers=headers)

            resp = await client.get("/incidents/open", headers=headers)
            assert resp.status_code == 200
            assert len(resp.json()) >= 1


