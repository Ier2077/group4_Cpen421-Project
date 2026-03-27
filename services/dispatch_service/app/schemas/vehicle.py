from pydantic import BaseModel
from datetime import datetime
from app.models.vehicle import ServiceType, VehicleStatus


class VehicleRegisterRequest(BaseModel):
    service_type: ServiceType
    organization_id: str
    plate_number: str
    assigned_personnel_name: str | None = None
    assigned_user_id: str | None = None
    latitude: float
    longitude: float


class LocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float


class VehicleStatusUpdateRequest(BaseModel):
    vehicle_status: VehicleStatus
    is_available: bool | None = None


class VehicleAssignRequest(BaseModel):
    incident_id: str
    vehicle_id: str


class VehicleResponse(BaseModel):
    id: str
    service_type: str
    organization_id: str
    plate_number: str
    assigned_personnel_name: str | None
    incident_id: str | None
    latitude: float
    longitude: float
    vehicle_status: str
    is_available: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class LocationResponse(BaseModel):
    vehicle_id: str
    latitude: float
    longitude: float
    updated_at: datetime