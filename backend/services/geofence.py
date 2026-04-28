from math import radians, sin, cos, sqrt, atan2

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
 
    """
    Calculates distance between two GPS coordinates using the Haversine formula.
    Returns distance in meters.
    """
    # Earth's radius in meters
    r = 6371000.0 

    #Convert coordinate differences to radians
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    # Haversine formula
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
    
    """
    Determine whether a user is inside the allowed classroom geofecne.

    Includes a GPS accuracy buffer to reduce false negatives caused by mobile locaation drift.
    """

    # Calculate distance from user to geofence center
    distance_m = haversine_m(user_lat, user_lon, center_lat, center_lon)

    # Apply a GPS accuracy buffer (max 50m)
    # This helps avoid incorrect rejection due to location inaccuracy
    buffer_m = min(accuracy_m, 50.0)

    #Final allowed distance = classroom radius + GPS buffer
    allowed_distance_m = radius_m + buffer_m

    # User is valid if inside allowed range
    ok = distance_m <= allowed_distance_m

    return {
        "ok": ok,
        "reason": "Inside geofence" if ok else "Outside geofence",
        "distance_m": distance_m,
        "allowed_distance_m": allowed_distance_m
    }