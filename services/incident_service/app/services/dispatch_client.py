"""
HTTP client for talking to the Dispatch Service.
"""
import httpx
from app.core.config import settings


async def get_available_vehicles(service_type: str) -> list[dict]:
    url = f"{settings.DISPATCH_SERVICE_URL}/vehicles/available"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params={"service_type": service_type})
        resp.raise_for_status()
        return resp.json()


async def assign_vehicle(vehicle_id: str, incident_id: str) -> dict:
    url = f"{settings.DISPATCH_SERVICE_URL}/vehicles/{vehicle_id}/assign"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json={"incident_id": incident_id, "vehicle_id": vehicle_id})
        resp.raise_for_status()
        return resp.json()


async def release_vehicle(vehicle_id: str) -> dict:
    url = f"{settings.DISPATCH_SERVICE_URL}/vehicles/{vehicle_id}/release"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url)
        resp.raise_for_status()
        return resp.json()