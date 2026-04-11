from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.geofence import evaluate_geofence

router = APIRouter(tags=["checkin"])

SESSION = {
    #for tetsing use your own lon and lat
    "id": "demo-1",
    "center_lat": 32.97513,
    "center_lon": "-96.33246", 
    "radius_m": 75.0,
    "is_open": True,
}

CHECKINS = []

class SessionOut(BaseModel):
    id: str
    center_lat: float
    center_lon: float
    radius_m: float
    is_open: bool


class CheckInIn(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    lat: float
    lon: float
    accuracy_m: float = Field(ge=0, le=20000)


class CheckInOut(BaseModel):
    ok: bool
    reason: str
    distance_m: float
    allowed_distance_m: float
    server_time: str


@router.get("/session", response_model=SessionOut)
def get_session():
    return SESSION

@router.post("/session", response_model=SessionOut)
def update_session(session: SessionOut):
    global SESSION
    SESSION = session.model_dump()
    return SESSION

@router.post("/checkin", response_model=CheckInOut)
def cehck_in(payload: CheckInIn):
    if not SESSION["is_open"]:
        return CheckInOut(
            ok=False,
            reason="Session closed",
            distance_m=0,
            allowed_distance_m=0,
            server_time=datetime.now(timezone.utc).isoformat(),
        )
    
    result = evaluate_geofence(
        user_lat=payload.lat,
        user_lon=payload.lon,
        accuracy_m=payload.accuracy_m,
        center_lat=SESSION["center_lat"],
        center_lon=SESSION["center_lon"],
        radius_m=SESSION["radius_m"],
    )

    CHECKINS.append(
        {
            "student_id": payload.student_id,
            "lat": payload.lat,
            "lon": payload.lon,
            "accuracy_m": payload.accuracy_m,
            "distance_m": result["distance_m"],
            "allowed_m": result["allowed_distance_m"],
            "ok": result["ok"],
            "time_utc": datetime.now(timezone.utc).isoformat(),
        }
    )

    return CheckInOut(
        ok=result["ok"],
        reason=result["reason"],
        distance_m=result["distance_m"],
        allowed_distance_m=result["allowed_distance_m"],
        server_time=datetime.now(timezone.utc).isoformat(),
    )

@router.get("/checkins")
def list_checkins() -> List[dict]:
    return CHECKINS