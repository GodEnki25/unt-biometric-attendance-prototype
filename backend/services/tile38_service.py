import redis

#Tile38 supports Redis RESP protocol, so redis-py can be used as the client.
#RESP2 is foced becise Tile38 does not support Redis newer HELLO handshake.
tile38 = redis.Redis(
    host="localhost",
    port=9851,
    decode_responses=True,
    protocol=2,
)

#Store the active classroom location under session ID.
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

#Query Tile38 for session IDs whos stored point falls within the allowed radius.
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