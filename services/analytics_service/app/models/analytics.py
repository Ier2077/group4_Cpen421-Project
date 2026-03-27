import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import String, Float, Integer, DateTime, Enum as SAEnum, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IncidentRecord(Base):
    """Denormalized read-model built from RabbitMQ events."""
    __tablename__ = "incident_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # same as incident_id
    incident_type: Mapped[str] = mapped_column(String(50), index=True)
    region: Mapped[str | None] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(30), default="CREATED")
    assigned_vehicle_id: Mapped[str | None] = mapped_column(String(36))
    unit_type: Mapped[str | None] = mapped_column(String(30))
    hospital_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_time_seconds: Mapped[int | None] = mapped_column(Integer)   # dispatched - created
    resolution_time_seconds: Mapped[int | None] = mapped_column(Integer) # resolved - created
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class VehicleDeployment(Base):
    """Counts how many times each vehicle was deployed."""
    __tablename__ = "vehicle_deployments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    vehicle_id: Mapped[str] = mapped_column(String(36), index=True)
    incident_id: Mapped[str] = mapped_column(String(36))
    unit_type: Mapped[str | None] = mapped_column(String(30))
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))