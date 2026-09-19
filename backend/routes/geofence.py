from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.tile38_service import save_geofence, check_geofence

router = APIRouter(
    prefix="/geofence",
    tags=["geofence"],
)

# Active instructor-controlled geofence session.
# The instructor dasshboard supplies the center coordinates
# and classroom radius when the session begins.
ACTIVE_SESSION = {
    "id": "demo-1",
    "center_lat": 0.0,
    "center_lon":  0.0,
    "radius_m": 15,
    "is_open": False,
}

class StartGeofenceSessionRequest(BaseModel):
    center_lat: float
    center_lon: float

    # Classroom radius may be customized between
    # approx 32 ft and 82ft
    radius_m: float = Field(ge=10, le=25)

class GeofenceCheckRequest(BaseModel):
    lat: float
    lon: float

    # GPS accuracy reported by the student's device
    accuracy_m: float = Field(ge=0, le=20000)


@router.get("/session")
def get_active_geofence_session():
    return ACTIVE_SESSION

@router.post("/session/start")
def start_geofence_session(payload: StartGeofenceSessionRequest):

    ACTIVE_SESSION["center_lat"] = payload.center_lat
    ACTIVE_SESSION["center_lon"] = payload.center_lon
    ACTIVE_SESSION["radius_m"] = payload.radius_m
    ACTIVE_SESSION["is_open"] = True

    save_geofence(
        session_id=ACTIVE_SESSION["id"],
        center_lat=ACTIVE_SESSION["center_lat"],
        center_lon=ACTIVE_SESSION["center_lon"],
    )

    return {
        "message": "Geofence session started",
        "session": ACTIVE_SESSION,
        "engine": "tile38",
    }

@router.post("/session/end")
def end_geofence_session():

    ACTIVE_SESSION["is_open"] = False

    return {
        "message": "Geofence session ended",
        "session": ACTIVE_SESSION,
        "engine": "tile38",
    }

@router.post("/check")
def check_student_location(payload: GeofenceCheckRequest):
    if not ACTIVE_SESSION["is_open"]:
        return {
            "inside": False,
            "allow_biometric": False,
            "reason": "Session closed",
            "engine": "tile38",
        }

    # GPS accuracy is treated seperately from
    # the instructor-selected classroom radius
    #
    # Cap the additional tolerance at 10 meters
    # so poor GPS accuracy cannot turn a classroom
    # geofence into a building-sized geofence.
    accuracy_buffer_m = min(payload.accuracy_m, 10.0)

    allowed_radius_m = ( ACTIVE_SESSION["radius_m"] + accuracy_buffer_m)

    #Tile38 is the authorative geofence engine
    #Frontend only receives the reulsting inside/outside decision.
    inside = check_geofence(
        session_id=ACTIVE_SESSION["id"],
        user_lat=payload.lat,
        user_lon=payload.lon,
        radius_m=allowed_radius_m,
    )

    return {
        "inside": inside,
        "allow_biometric": inside,
        "reason": "Inside geofence" if inside else "Outside geofence",
        "radius_m": ACTIVE_SESSION["radius_m"],
        "accuracy_buffer_m": accuracy_buffer_m,
        "allowed_radius_m": allowed_radius_m,
        "engine": "tile38",
    }