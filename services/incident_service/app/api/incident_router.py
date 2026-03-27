from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.incident import (
    IncidentCreateRequest,
    IncidentStatusUpdateRequest,
    IncidentAssignRequest,
    IncidentResponse,
)
from app.services.incident_service import (
    create_incident,
    get_incident,
    get_open_incidents,
    update_incident_status,
)
from app.core.dependencies import get_current_user, require_roles
from shared.jwt_utils import TokenPayload

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.post("", response_model=IncidentResponse, status_code=201)
async def create(
    req: IncidentCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: TokenPayload = Depends(require_roles("system_admin")),
):
    return await create_incident(db, req, created_by=user.sub)


@router.get("/open", response_model=list[IncidentResponse])
async def list_open(
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_roles("system_admin", "hospital_admin", "police_admin", "fire_admin")),
):
    return await get_open_incidents(db)


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_one(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(get_current_user),
):
    return await get_incident(db, incident_id)


@router.put("/{incident_id}/status", response_model=IncidentResponse)
async def update_status(
    incident_id: str,
    req: IncidentStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_roles("system_admin", "police_admin", "fire_admin", "hospital_admin")),
):
    return await update_incident_status(db, incident_id, req)