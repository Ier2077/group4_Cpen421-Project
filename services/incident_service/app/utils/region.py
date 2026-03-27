"""
Simple zone-bucketing for Ghana/Accra lat/lon.
For production, use a geocoding API.  
"""


REGIONS = [
    ("Greater Accra", (5.45, 5.75), (-0.35, 0.15)),
    ("Ashanti", (6.40, 7.00), (-1.80, -1.20)),
    ("Western", (4.70, 5.50), (-3.00, -1.50)),
    ("Eastern", (5.70, 6.60), (-0.80, 0.10)),
    ("Central", (5.10, 5.70), (-1.80, -0.80)),
    ("Volta", (5.80, 8.50), (0.10, 1.10)),
    ("Northern", (9.00, 10.80), (-2.50, 0.60)),
    ("Upper East", (10.50, 11.20), (-1.10, 0.60)),
    ("Upper West", (9.50, 11.00), (-2.80, -1.10)),
    ("Brong-Ahafo", (6.80, 8.60), (-2.80, -0.80)),
]


def lat_lon_to_region(lat: float, lon: float) -> str:
    for name, (lat_min, lat_max), (lon_min, lon_max) in REGIONS:
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return name
    return "Unknown"