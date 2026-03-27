"""Haversine distance between two lat/lon points. Returns km."""
import math


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def nearest(
    origin_lat: float,
    origin_lon: float,
    candidates: list[dict],  # each dict must have "latitude", "longitude"
) -> dict | None:
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda c: haversine(origin_lat, origin_lon, c["latitude"], c["longitude"]),
    )