import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import String, Float, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ServiceType(str, enum.Enum):
    ambulance = "ambulance"
    police = "police"
    fire = "fire"


class VehicleStatus(str, enum.Enum):
    available = "available"
    en_route = "en_route"
    on_scene = "on_scene"
    returning = "returning"
    offline = "offline"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    service_type: Mapped[ServiceType] = mapped_column(SAEnum(ServiceType), nullable=False, index=True)
    organization_id: Mapped[str] = mapped_column(String(100), nullable=False)
    plate_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    assigned_personnel_name: Mapped[str | None] = mapped_column(String(200))
    assigned_user_id: Mapped[str | None] = mapped_column(String(36))   # ambulance_driver user id
    incident_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    longitude: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    vehicle_status: Mapped[VehicleStatus] = mapped_column(
        SAEnum(VehicleStatus), default=VehicleStatus.available
    )
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )