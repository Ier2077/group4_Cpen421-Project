import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base, get_db

TEST_DB = "sqlite+aiosqlite:///./test_dispatch.db"
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


# Mock JWT for tests
from shared.jwt_utils import create_access_token


def admin_token():
    return create_access_token({"sub": "test-id", "role": "system_admin", "email": "admin@test.gh"})


@pytest.mark.anyio
async def test_register_and_list_vehicles():
    with patch("shared.rabbitmq.publisher.publish", new_callable=AsyncMock):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {admin_token()}"}
            resp = await client.post("/vehicles/register", json={
                "service_type": "ambulance",
                "organization_id": "korlebu",
                "plate_number": "TEST-001",
                "assigned_personnel_name": "Driver One",
                "latitude": 5.539,
                "longitude": -0.227,
            }, headers=headers)
            assert resp.status_code == 201
            v = resp.json()
            assert v["plate_number"] == "TEST-001"
            assert v["is_available"] is True

            resp = await client.get("/vehicles/available?service_type=ambulance")
            assert resp.status_code == 200
            assert len(resp.json()) == 1


@pytest.mark.anyio
async def test_location_update():
    with patch("shared.rabbitmq.publisher.publish", new_callable=AsyncMock):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {admin_token()}"}

            reg = await client.post("/vehicles/register", json={
                "service_type": "police",
                "organization_id": "accra_police",
                "plate_number": "POL-TEST",
                "latitude": 5.55,
                "longitude": -0.20,
            }, headers=headers)
            vid = reg.json()["id"]

            resp = await client.post(f"/vehicles/{vid}/location", json={
                "latitude": 5.56,
                "longitude": -0.21,
            }, headers=headers)
            assert resp.status_code == 200
            assert resp.json()["latitude"] == 5.56