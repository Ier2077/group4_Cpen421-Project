import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.db.base import Base, get_db

TEST_DB = "sqlite+aiosqlite:///./test_auth.db"
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


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_register_and_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register
        resp = await client.post("/auth/register", json={
            "name": "Test Admin",
            "email": "test@erp.gh",
            "password": "secret123",
            "role": "system_admin",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "test@erp.gh"
        assert data["role"] == "system_admin"

        # Login
        resp = await client.post("/auth/login", json={
            "email": "test@erp.gh",
            "password": "secret123",
        })
        assert resp.status_code == 200
        tokens = resp.json()
        assert "access_token" in tokens
        assert "refresh_token" in tokens

        # Profile
        resp = await client.get(
            "/auth/profile",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@erp.gh"


@pytest.mark.anyio
async def test_login_invalid_credentials():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/auth/login", json={
            "email": "nobody@erp.gh",
            "password": "wrong",
        })
        assert resp.status_code == 401


@pytest.mark.anyio
async def test_duplicate_email():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {"name": "A", "email": "dup@erp.gh", "password": "p", "role": "system_admin"}
        await client.post("/auth/register", json=payload)
        resp = await client.post("/auth/register", json=payload)
        assert resp.status_code == 400