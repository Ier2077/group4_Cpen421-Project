"""
Listens for incident events to update vehicle availability.
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import AsyncSessionLocal
from app.services.vehicle_service import release_vehicle
from shared.rabbitmq import RabbitMQConsumer

logger = logging.getLogger(__name__)

consumer = RabbitMQConsumer(
    queue_name="dispatch.incident_events",
    routing_keys=["incident.resolved", "incident.assigned"],
)


async def handle_event(routing_key: str, payload: dict):
    logger.info(f"Dispatch consumer received [{routing_key}]: {payload}")
    async with AsyncSessionLocal() as db:
        if routing_key == "incident.resolved":
            vehicle_id = payload.get("assigned_vehicle_id")
            if vehicle_id:
                try:
                    await release_vehicle(db, vehicle_id)
                    logger.info(f"Vehicle {vehicle_id} released after incident resolved.")
                except Exception as e:
                    logger.error(f"Failed to release vehicle {vehicle_id}: {e}")