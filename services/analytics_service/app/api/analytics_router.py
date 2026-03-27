from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.services.analytics_service import get_response_times, get_incidents_by_region, get_resource_utilization
from app.core.dependencies import require_roles

router = APIRouter(prefix="/analytics", tags=["Analytics"])

ALLOWED = ("system_admin", "hospital_admin", "police_admin", "fire_admin")


@router.get("/response-times")
async def response_times(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*ALLOWED)),
):
    return await get_response_times(db)


@router.get("/incidents-by-region")
async def incidents_by_region(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*ALLOWED)),
):
    return await get_incidents_by_region(db)


@router.get("/resource-utilization")
async def resource_utilization(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(*ALLOWED)),
):
    return await get_resource_utilization(db)   