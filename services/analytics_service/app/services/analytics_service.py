from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.analytics import IncidentRecord, VehicleDeployment


async def get_response_times(db: AsyncSession) -> dict:
    result = await db.execute(
        select(
            func.count(IncidentRecord.id).label("total"),
            func.avg(IncidentRecord.response_time_seconds).label("avg_response_seconds"),
            func.avg(IncidentRecord.resolution_time_seconds).label("avg_resolution_seconds"),
            func.min(IncidentRecord.response_time_seconds).label("min_response_seconds"),
            func.max(IncidentRecord.response_time_seconds).label("max_response_seconds"),
        )
    )
    row = result.one()
    return {
        "total_incidents": row.total,
        "avg_response_time_seconds": round(row.avg_response_seconds or 0, 1),
        "avg_resolution_time_seconds": round(row.avg_resolution_seconds or 0, 1),
        "min_response_time_seconds": row.min_response_seconds,
        "max_response_time_seconds": row.max_response_seconds,
    }


async def get_incidents_by_region(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(
            IncidentRecord.region,
            IncidentRecord.incident_type,
            func.count(IncidentRecord.id).label("count"),
        ).group_by(IncidentRecord.region, IncidentRecord.incident_type)
        .order_by(IncidentRecord.region, IncidentRecord.incident_type)
    )
    rows = result.all()
    return [{"region": r.region or "Unknown", "incident_type": r.incident_type, "count": r.count} for r in rows]


async def get_resource_utilization(db: AsyncSession) -> dict:
    # Vehicle deployment counts
    deploy_result = await db.execute(
        select(
            VehicleDeployment.vehicle_id,
            VehicleDeployment.unit_type,
            func.count(VehicleDeployment.id).label("deployments"),
        ).group_by(VehicleDeployment.vehicle_id, VehicleDeployment.unit_type)
        .order_by(func.count(VehicleDeployment.id).desc())
        .limit(20)
    )
    deployments = [
        {"vehicle_id": r.vehicle_id, "unit_type": r.unit_type, "deployments": r.deployments}
        for r in deploy_result.all()
    ]

    # Status breakdown
    status_result = await db.execute(
        select(
            IncidentRecord.status,
            func.count(IncidentRecord.id).label("count"),
        ).group_by(IncidentRecord.status)
    )
    status_breakdown = {r.status: r.count for r in status_result.all()}

    # Unit type breakdown
    unit_result = await db.execute(
        select(
            IncidentRecord.unit_type,
            func.count(IncidentRecord.id).label("count"),
        ).where(IncidentRecord.unit_type.isnot(None))
        .group_by(IncidentRecord.unit_type)
    )
    unit_breakdown = {r.unit_type: r.count for r in unit_result.all()}

    return {
        "top_deployed_vehicles": deployments,
        "incidents_by_status": status_breakdown,
        "incidents_by_unit_type": unit_breakdown,
    }