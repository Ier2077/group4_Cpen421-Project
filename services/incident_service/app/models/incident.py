import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import String, Float, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IncidentType(str, enum.Enum):
    medical = "medical"
    fire = "fire"
    crime = "crime"
    robbery = "robbery"
    assault = "assault"
    accident = "accident"
    other = "other"


class IncidentStatus(str, enum.Enum):
    CREATED = "CREATED"
    DISPATCHED = "DISPATCHED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class UnitType(str, enum.Enum):
    ambulance = "ambulance"
    police = "police"
    fire = "fire"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    citizen_name: Mapped[str] = mapped_column(String(200), nullable=False)
    citizen_phone: Mapped[str | None] = mapped_column(String(30))
    incident_type: Mapped[IncidentType] = mapped_column(SAEnum(IncidentType), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    region: Mapped[str | None] = mapped_column(String(100))         # computed from lat/lon

    created_by: Mapped[str] = mapped_column(String(36), nullable=False)  # admin user id

    assigned_vehicle_id: Mapped[str | None] = mapped_column(String(36))
    assigned_unit_type: Mapped[UnitType | None] = mapped_column(SAEnum(UnitType))
    assigned_hospital_id: Mapped[str | None] = mapped_column(String(36))
    assigned_hospital_name: Mapped[str | None] = mapped_column(String(200))

    status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(IncidentStatus), default=IncidentStatus.CREATED, index=True
    )
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Hospital(Base):
    """Hospitals are seeded — no extra microservice needed."""
    __tablename__ = "hospitals"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    available_beds: Mapped[int] = mapped_column(default=0)
    total_beds: Mapped[int] = mapped_column(default=0)
    region: Mapped[str | None] = mapped_column(String(100))