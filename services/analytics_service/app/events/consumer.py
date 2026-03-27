import logging
from datetime import datetime, timezone, timedelta

from app.db.base import AsyncSessionLocal
from app.models.analytics import IncidentRecord, VehicleDeployment
from sqlalchemy import select
from shared.rabbitmq import RabbitMQConsumer
import uuid

logger = logging.getLogger(__name__)

consumer = RabbitMQConsumer(
    queue_name="analytics.all_events",
    routing_keys=["incident.*", "vehicle.*"],
)


def _parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val)
    except Exception:
        return None


async def handle_event(routing_key: str, payload: dict):
    logger.info(f"Analytics received [{routing_key}]")
    async with AsyncSessionLocal() as db:
        try:
            if routing_key == "incident.created":
                rec = IncidentRecord(
                    id=payload["incident_id"],
                    incident_type=payload.get("incident_type", "unknown"),
                    region=payload.get("region"),
                    status="CREATED",
                    created_at=datetime.now(timezone.utc),
                )
                db.add(rec)

            elif routing_key == "incident.assigned":
                result = await db.execute(
                    select(IncidentRecord).where(IncidentRecord.id == payload["incident_id"])
                )
                rec: IncidentRecord | None = result.scalar_one_or_none()
                if rec:
                    rec.status = "DISPATCHED"
                    rec.assigned_vehicle_id = payload.get("vehicle_id")
                    rec.unit_type = payload.get("unit_type")
                    rec.hospital_id = payload.get("hospital_id")
                    rec.dispatched_at = datetime.now(timezone.utc)
                    if rec.created_at:
                        delta = rec.dispatched_at - rec.created_at.replace(tzinfo=timezone.utc)
                        rec.response_time_seconds = int(delta.total_seconds())
                # Record deployment
                if payload.get("vehicle_id"):
                    dep = VehicleDeployment(
                        id=str(uuid.uuid4()),
                        vehicle_id=payload["vehicle_id"],
                        incident_id=payload["incident_id"],
                        unit_type=payload.get("unit_type"),
                    )
                    db.add(dep)

            elif routing_key in ("incident.status_updated", "incident.resolved"):
                result = await db.execute(
                    select(IncidentRecord).where(IncidentRecord.id == payload["incident_id"])
                )
                rec = result.scalar_one_or_none()
                if rec:
                    rec.status = payload.get("new_status", rec.status)
                    if payload.get("dispatched_at"):
                        rec.dispatched_at = _parse_dt(payload["dispatched_at"])
                    if payload.get("resolved_at"):
                        rec.resolved_at = _parse_dt(payload["resolved_at"])
                        if rec.created_at and rec.resolved_at:
                            base = rec.created_at.replace(tzinfo=timezone.utc) if rec.created_at.tzinfo is None else rec.created_at
                            delta = rec.resolved_at - base
                            rec.resolution_time_seconds = int(delta.total_seconds())
                    rec.updated_at = datetime.now(timezone.utc)
                # Update vehicle deployment record
                if routing_key == "incident.resolved" and payload.get("assigned_vehicle_id"):
                    result2 = await db.execute(
                        select(VehicleDeployment).where(
                            VehicleDeployment.vehicle_id == payload["assigned_vehicle_id"],
                            VehicleDeployment.incident_id == payload["incident_id"],
                        )
                    )
                    dep = result2.scalar_one_or_none()
                    if dep:
                        dep.released_at = datetime.now(timezone.utc)

            await db.commit()
        except Exception as e:
            logger.error(f"Error handling analytics event [{routing_key}]: {e}", exc_info=True)     