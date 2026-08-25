from math import radians, sin, cos, sqrt, atan2

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0 #earth rad
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2 
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c

def evaluate_geofence(
        user_lat: float,
        user_lon: float,
        accuracy_m: float,
        center_lat: float,
        center_lon: float,
        radius_m: float,
) -> dict:
    distance_m = haversine_m(user_lat, user_lon, center_lat, center_lon)

    buffer_m = min(accuracy_m, 50.0) #allow buffer of 50 meters for gps drift
    allowed_distance_m = radius_m + buffer_m
    ok = distance_m <= allowed_distance_m

    return {
        "ok": ok,
        "reason": "Inside geofence" if ok else "Outside geofence",
        "distance_m": distance_m,
        "allowed_distance_m": allowed_distance_m
    }