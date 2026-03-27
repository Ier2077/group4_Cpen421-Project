import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import Vehicle, ServiceType, VehicleStatus
from app.schemas.vehicle import VehicleRegisterRequest, LocationUpdateRequest, VehicleStatusUpdateRequest
from shared.rabbitmq import publisher


async def register_vehicle(db: AsyncSession, req: VehicleRegisterRequest) -> Vehicle:
    existing = await db.execute(select(Vehicle).where(Vehicle.plate_number == req.plate_number))
    if existing.scalar_one_or_none():
        raise HTTPException(400, detail="Vehicle with this plate number already registered")
    vehicle = Vehicle(
        id=str(uuid.uuid4()),
        **req.model_dump(),
    )
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    await publisher.publish("vehicle.registered", {"vehicle_id": vehicle.id, "service_type": vehicle.service_type})
    return vehicle


async def get_all_vehicles(db: AsyncSession, service_type: ServiceType | None = None) -> list[Vehicle]:
    q = select(Vehicle)
    if service_type:
        q = q.where(Vehicle.service_type == service_type)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_available_vehicles(db: AsyncSession, service_type: ServiceType | None = None) -> list[Vehicle]:
    q = select(Vehicle).where(Vehicle.is_available == True)  # noqa
    if service_type:
        q = q.where(Vehicle.service_type == service_type)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_vehicle(db: AsyncSession, vehicle_id: str) -> Vehicle:
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(404, detail="Vehicle not found")
    return v


async def update_location(
    db: AsyncSession, vehicle_id: str, req: LocationUpdateRequest, websocket_manager=None
) -> Vehicle:
    vehicle = await get_vehicle(db, vehicle_id)
    vehicle.latitude = req.latitude
    vehicle.longitude = req.longitude
    vehicle.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(vehicle)

    payload = {
        "vehicle_id": vehicle_id,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "incident_id": vehicle.incident_id,
        "timestamp": vehicle.updated_at.isoformat(),
    }
    await publisher.publish("vehicle.location_updated", payload)

    # Broadcast via WebSocket
    if websocket_manager and vehicle.incident_id:
        await websocket_manager.broadcast_to_incident(vehicle.incident_id, payload)

    return vehicle


async def update_vehicle_status(db: AsyncSession, vehicle_id: str, req: VehicleStatusUpdateRequest) -> Vehicle:
    vehicle = await get_vehicle(db, vehicle_id)
    vehicle.vehicle_status = req.vehicle_status
    if req.is_available is not None:
        vehicle.is_available = req.is_available
    await db.commit()
    await db.refresh(vehicle)
    return vehicle


async def assign_vehicle_to_incident(db: AsyncSession, vehicle_id: str, incident_id: str) -> Vehicle:
    vehicle = await get_vehicle(db, vehicle_id)
    if not vehicle.is_available:
        raise HTTPException(409, detail="Vehicle not available")
    vehicle.incident_id = incident_id
    vehicle.is_available = False
    vehicle.vehicle_status = VehicleStatus.en_route
    vehicle.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(vehicle)
    await publisher.publish("vehicle.assigned", {"vehicle_id": vehicle_id, "incident_id": incident_id})
    return vehicle


async def release_vehicle(db: AsyncSession, vehicle_id: str) -> Vehicle:
    vehicle = await get_vehicle(db, vehicle_id)
    vehicle.incident_id = None
    vehicle.is_available = True
    vehicle.vehicle_status = VehicleStatus.available
    vehicle.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(vehicle)
    await publisher.publish("vehicle.released", {"vehicle_id": vehicle_id})
    return vehicle