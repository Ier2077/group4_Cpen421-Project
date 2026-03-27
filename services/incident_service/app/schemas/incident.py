from pydantic import BaseModel
from datetime import datetime
from app.models.incident import IncidentType, IncidentStatus, UnitType


class IncidentCreateRequest(BaseModel):
    citizen_name: str
    citizen_phone: str | None = None
    incident_type: IncidentType
    latitude: float
    longitude: float
    notes: str | None = None


class IncidentStatusUpdateRequest(BaseModel):
    status: IncidentStatus


class IncidentAssignRequest(BaseModel):
    vehicle_id: str
    hospital_id: str | None = None


class IncidentResponse(BaseModel):
    id: str
    citizen_name: str
    citizen_phone: str | None
    incident_type: str
    latitude: float
    longitude: float
    notes: str | None
    region: str | None
    created_by: str
    assigned_vehicle_id: str | None
    assigned_unit_type: str | None
    assigned_hospital_id: str | None
    assigned_hospital_name: str | None
    status: str
    dispatched_at: datetime | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HospitalResponse(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    available_beds: int
    total_beds: int
    region: str | None

    model_config = {"from_attributes": True}    