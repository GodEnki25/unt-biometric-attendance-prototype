import redis

tile38 = redis.Redis(
    host="localhost",
    port=9851,
    decode_responses=True,
    protocol=2,
)

def save_geofence(
        session_id: str,
        center_lat: float,
        center_lon: float,
) -> bool:
    result = tile38.execute_command(
        "SET",
        "class_geofences",
        session_id,
        "POINT",
        center_lat,
        center_lon,
    )

    return result is True or result == "OK"

def check_geofence(
        session_id: str,
        user_lat: float,
        user_lon: float,
        radius_m: float,
) -> bool:
    result = tile38.execute_command(
        "NEARBY",
        "class_geofences",
        "IDS",
        "POINT",
        user_lat,
        user_lon,
        radius_m,
    )

    ids = result[1]

    return session_id in ids