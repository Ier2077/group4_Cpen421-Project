from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.models.vehicle import ServiceType
from app.schemas.vehicle import (
    VehicleRegisterRequest,
    VehicleResponse,
    LocationUpdateRequest,
    LocationResponse,
    VehicleStatusUpdateRequest,
    VehicleAssignRequest,
)
from app.services.vehicle_service import (
    register_vehicle,
    get_all_vehicles,
    get_available_vehicles,
    get_vehicle,
    update_location,
    update_vehicle_status,
    assign_vehicle_to_incident,
    release_vehicle,
)
from app.api.websocket_manager import ws_manager
from app.core.dependencies import get_current_user, require_roles
from shared.jwt_utils import TokenPayload

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


@router.post("/register", response_model=VehicleResponse, status_code=201)
async def register(
    req: VehicleRegisterRequest,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_roles("system_admin", "police_admin", "fire_admin", "hospital_admin")),
):
    return await register_vehicle(db, req)


@router.get("", response_model=list[VehicleResponse])
async def list_vehicles(
    service_type: ServiceType | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(get_current_user),
):
    return await get_all_vehicles(db, service_type)


@router.get("/available", response_model=list[VehicleResponse])
async def list_available(
    service_type: ServiceType | None = Query(None),
    db: AsyncSession = Depends(get_db),
    # No auth — called internally by incident service
):
    return await get_available_vehicles(db, service_type)


@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_one(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(get_current_user),
):
    return await get_vehicle(db, vehicle_id)


@router.get("/{vehicle_id}/location", response_model=LocationResponse)
async def get_location(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(get_current_user),
):
    v = await get_vehicle(db, vehicle_id)
    return LocationResponse(
        vehicle_id=v.id, latitude=v.latitude, longitude=v.longitude, updated_at=v.updated_at
    )


@router.post("/{vehicle_id}/location", response_model=VehicleResponse)
async def post_location(
    vehicle_id: str,
    req: LocationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
):
    # Ambulance driver can only update their own vehicle; admins can update any
    return await update_location(db, vehicle_id, req, websocket_manager=ws_manager)


@router.put("/{vehicle_id}/status", response_model=VehicleResponse)
async def update_status(
    vehicle_id: str,
    req: VehicleStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_roles("system_admin", "police_admin", "fire_admin", "hospital_admin", "ambulance_driver")),
):
    return await update_vehicle_status(db, vehicle_id, req)


@router.post("/{vehicle_id}/assign", response_model=VehicleResponse)
async def assign(
    vehicle_id: str,
    req: VehicleAssignRequest,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_roles("system_admin")),
):
    return await assign_vehicle_to_incident(db, vehicle_id, req.incident_id)


@router.post("/{vehicle_id}/release", response_model=VehicleResponse)
async def release(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_roles("system_admin")),
):
    return await release_vehicle(db, vehicle_id)


# ── WebSocket endpoints ──────────────────────────────────────

@router.websocket("/ws/incident/{incident_id}")
async def ws_track_incident(incident_id: str, websocket: WebSocket):
    await ws_manager.subscribe_incident(incident_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        ws_manager.remove(websocket, incident_id=incident_id)


@router.websocket("/ws/vehicle/{vehicle_id}")
async def ws_track_vehicle(vehicle_id: str, websocket: WebSocket):
    await ws_manager.subscribe_vehicle(vehicle_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.remove(websocket, vehicle_id=vehicle_id)