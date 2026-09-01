from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.tile38_service import save_geofence, check_geofence

router = APIRouter(
    prefix="/geofence",
    tags=["geofence"],
)

# Temporary active session until the instructor-side controls are wired in.
MOCK_SESSION = {
    "id": "demo-1",
    "center_lat": 32.5353638,
    "center_lon":  -96.3324661252,
    "radius_m": 75.0,
    "is_open": True,
}


class GeofenceCheckRequest(BaseModel):
    lat: float
    lon: float
    accuracy_m: float = Field(ge=0, le=20000)


@router.get("/session")
def get_active_geofence_session():
    return MOCK_SESSION


@router.post("/check")
def check_student_location(payload: GeofenceCheckRequest):
    if not MOCK_SESSION["is_open"]:
        return {
            "inside": False,
            "allow_biometric": False,
            "reason": "Session closed",
            "engine": "tile38",
        }

    # Temporary until the professor side creates/updates sessions.
    save_geofence(
        session_id=MOCK_SESSION["id"],
        center_lat=MOCK_SESSION["center_lat"],
        center_lon=MOCK_SESSION["center_lon"],
    )

    # Preserve the GPS accuracy buffer from the original prototype.
    buffer_m = min(payload.accuracy_m, 50.0)
    allowed_radius_m = MOCK_SESSION["radius_m"] + buffer_m

    #Tile38 is the authorative geofence engine
    #Frontend only receives the reulsting inside/outside decision.
    inside = check_geofence(
        session_id=MOCK_SESSION["id"],
        user_lat=payload.lat,
        user_lon=payload.lon,
        radius_m=allowed_radius_m,
    )

    return {
        "inside": inside,
        "allow_biometric": inside,
        "reason": "Inside geofence" if inside else "Outside geofence",
        "radius_m": MOCK_SESSION["radius_m"],
        "accuracy_buffer_m": buffer_m,
        "allowed_radius_m": allowed_radius_m,
        "engine": "tile38",
    }