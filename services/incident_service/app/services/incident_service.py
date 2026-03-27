import uuid
import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident, IncidentStatus, IncidentType, UnitType, Hospital
from app.schemas.incident import IncidentCreateRequest, IncidentStatusUpdateRequest
from app.utils.region import lat_lon_to_region
from app.services.dispatch_client import get_available_vehicles, assign_vehicle, release_vehicle
from shared.haversine import nearest
from shared.rabbitmq import publisher

logger = logging.getLogger(__name__)


INCIDENT_TYPE_TO_SERVICE = {
    IncidentType.medical: "ambulance",
    IncidentType.fire: "fire",
    IncidentType.crime: "police",
    IncidentType.robbery: "police",
    IncidentType.assault: "police",
    IncidentType.accident: "ambulance",
    IncidentType.other: "police",
}

INCIDENT_TYPE_TO_UNIT = {
    "ambulance": UnitType.ambulance,
    "police": UnitType.police,
    "fire": UnitType.fire,
}


async def _find_nearest_hospital(db: AsyncSession, lat: float, lon: float) -> Hospital | None:
    result = await db.execute(select(Hospital).where(Hospital.available_beds > 0))
    hospitals = result.scalars().all()
    if not hospitals:
        return None
    candidates = [
        {"id": h.id, "name": h.name, "latitude": h.latitude, "longitude": h.longitude, "obj": h}
        for h in hospitals
    ]
    best = nearest(lat, lon, candidates)
    return best["obj"] if best else None


async def create_incident(
    db: AsyncSession, req: IncidentCreateRequest, created_by: str
) -> Incident:
    region = lat_lon_to_region(req.latitude, req.longitude)
    incident = Incident(
        id=str(uuid.uuid4()),
        citizen_name=req.citizen_name,
        citizen_phone=req.citizen_phone,
        incident_type=req.incident_type,
        latitude=req.latitude,
        longitude=req.longitude,
        notes=req.notes,
        region=region,
        created_by=created_by,
        status=IncidentStatus.CREATED,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)

    await publisher.publish("incident.created", {
        "incident_id": incident.id,
        "incident_type": incident.incident_type.value,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
        "region": region,
    })

    # Auto-dispatch
    try:
        await _auto_dispatch(db, incident)
    except Exception as e:
        logger.warning(f"Auto-dispatch failed for {incident.id}: {e}")

    return incident


async def _auto_dispatch(db: AsyncSession, incident: Incident):
    service_type = INCIDENT_TYPE_TO_SERVICE.get(incident.incident_type, "police")
    try:
        vehicles = await get_available_vehicles(service_type)
    except Exception as e:
        logger.error(f"Could not reach dispatch service: {e}")
        return

    if not vehicles:
        logger.warning(f"No available {service_type} vehicles for incident {incident.id}")
        return

    best = nearest(incident.latitude, incident.longitude, vehicles)
    if not best:
        return

    vehicle_id = best["id"]

    # For medical incidents, also find a hospital
    hospital: Hospital | None = None
    if incident.incident_type in (IncidentType.medical, IncidentType.accident):
        hospital = await _find_nearest_hospital(db, incident.latitude, incident.longitude)
        if hospital:
            hospital.available_beds -= 1   # reserve a bed
            await db.flush()

    # Assign in dispatch service
    try:
        await assign_vehicle(vehicle_id, incident.id)
    except Exception as e:
        logger.error(f"Failed to assign vehicle {vehicle_id}: {e}")
        return

    # Update incident
    incident.assigned_vehicle_id = vehicle_id
    incident.assigned_unit_type = INCIDENT_TYPE_TO_UNIT[service_type]
    incident.status = IncidentStatus.DISPATCHED
    incident.dispatched_at = datetime.now(timezone.utc)
    if hospital:
        incident.assigned_hospital_id = hospital.id
        incident.assigned_hospital_name = hospital.name

    await db.commit()
    await db.refresh(incident)

    await publisher.publish("incident.assigned", {
        "incident_id": incident.id,
        "vehicle_id": vehicle_id,
        "unit_type": service_type,
        "hospital_id": incident.assigned_hospital_id,
        "region": incident.region,
    })


async def get_incident(db: AsyncSession, incident_id: str) -> Incident:
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(404, detail="Incident not found")
    return inc


async def get_open_incidents(db: AsyncSession) -> list[Incident]:
    result = await db.execute(
        select(Incident).where(
            Incident.status.in_([IncidentStatus.CREATED, IncidentStatus.DISPATCHED, IncidentStatus.IN_PROGRESS])
        ).order_by(Incident.created_at.desc())
    )
    return list(result.scalars().all())


async def update_incident_status(
    db: AsyncSession, incident_id: str, req: IncidentStatusUpdateRequest
) -> Incident:
    incident = await get_incident(db, incident_id)
    old_status = incident.status
    incident.status = req.status
    incident.updated_at = datetime.now(timezone.utc)

    if req.status == IncidentStatus.RESOLVED:
        incident.resolved_at = datetime.now(timezone.utc)
        # Release vehicle
        if incident.assigned_vehicle_id:
            try:
                await release_vehicle(incident.assigned_vehicle_id)
            except Exception as e:
                logger.warning(f"Could not release vehicle: {e}")

    await db.commit()
    await db.refresh(incident)

    routing_key = "incident.resolved" if req.status == IncidentStatus.RESOLVED else "incident.status_updated"
    await publisher.publish(routing_key, {
        "incident_id": incident.id,
        "old_status": old_status.value,
        "new_status": req.status.value,
        "assigned_vehicle_id": incident.assigned_vehicle_id,
        "incident_type": incident.incident_type.value,
        "region": incident.region,
        "created_at": incident.created_at.isoformat(),
        "dispatched_at": incident.dispatched_at.isoformat() if incident.dispatched_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
    })
    return incident