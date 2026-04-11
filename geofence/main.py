from fastapi import FastAPI
from pydantic import BaseModel, Field
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timezone
from typing import List
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GeoFence PoC")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://127.0.0.1:8081", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Simple in-memory "DB" ---
SESSION = {
    "id": "demo-1",
    # Set this to campus/building center 
    "center_lat": 32.9497,
    "center_lon": -96.3312,
    "radius_m": 75.0,
    "is_open": True,
}

CHECKINS = []  # list of dicts


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    # Earth radius in meters
    R = 6371000.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


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


@app.get("/session", response_model=SessionOut)
def get_session():
    return SESSION


@app.post("/session", response_model=SessionOut)
def update_session(session: SessionOut):
    # Minimal admin update endpoint (for demo)
    global SESSION
    SESSION = session.model_dump()
    return SESSION


@app.post("/checkin", response_model=CheckInOut)
def check_in(payload: CheckInIn):
    if not SESSION["is_open"]:
        return CheckInOut(
            ok=False,
            reason="Session closed",
            distance_m=0,
            allowed_distance_m=0,
            server_time=datetime.now(timezone.utc).isoformat(),
        )

    dist = haversine_m(payload.lat, payload.lon, SESSION["center_lat"], SESSION["center_lon"])

    # Fairness buffer: allow radius + min(accuracy, 50m)
    buffer_m = min(payload.accuracy_m, 50.0)
    allowed = SESSION["radius_m"] + buffer_m

    ok = dist <= allowed
    reason = "Inside geofence" if ok else "Outside geofence"

    CHECKINS.append(
        {
            "student_id": payload.student_id,
            "lat": payload.lat,
            "lon": payload.lon,
            "accuracy_m": payload.accuracy_m,
            "distance_m": dist,
            "allowed_m": allowed,
            "ok": ok,
            "time_utc": datetime.now(timezone.utc).isoformat(),
        }
    )

    return CheckInOut(
        ok=ok,
        reason=reason,
        distance_m=dist,
        allowed_distance_m=allowed,
        server_time=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/checkins")
def list_checkins() -> List[dict]:
    return CHECKINS