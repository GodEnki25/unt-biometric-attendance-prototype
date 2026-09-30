from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.database.db import get_db_connection
from backend.services.tile38_service import save_geofence, check_geofence
from backend.services.token_service import get_current_user, require_instructor


# Dallas / Chicago Central Time.
# ZoneInfo automatically handles CST and CDT.
CENTRAL_TZ = ZoneInfo("America/Chicago")


router = APIRouter(
    prefix="/geofence",
    tags=["geofence"],
)


# Active instructor-controlled geofence session.
# This is kept in memory while the backend is running.
# If the backend restarts, restore_active_session()
# can rebuild it from SQLite.
ACTIVE_SESSION = {
    "id": None,
    "center_lat": 0.0,
    "center_lon": 0.0,
    "radius_m": 15,
    "is_open": False,
}


# =========================
# RESTORE ACTIVE SESSION
# =========================

def restore_active_session():
    """
    Restore an unfinished attendance session from SQLite
    after the backend restarts.

    Only a session from today's Central date with complete
    geofence information can be restored.
    """

    today = datetime.now(CENTRAL_TZ).strftime("%Y-%m-%d")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT
                session_id,
                geofence_lat,
                geofence_lng,
                geofence_radius
            FROM attendance_sessions
            WHERE end_time IS NULL
              AND session_date = ?
              AND geofence_lat IS NOT NULL
              AND geofence_lng IS NOT NULL
              AND geofence_radius IS NOT NULL
            ORDER BY session_id DESC
            LIMIT 1
            """,
            (today,),
        )

        session = cursor.fetchone()

        # No unfinished valid session exists.
        if not session:
            ACTIVE_SESSION["id"] = None
            ACTIVE_SESSION["center_lat"] = 0.0
            ACTIVE_SESSION["center_lon"] = 0.0
            ACTIVE_SESSION["radius_m"] = 15
            ACTIVE_SESSION["is_open"] = False

            return False

        session_id = str(session["session_id"])

        # Re-create the Tile38 geofence.
        # This also helps if Tile38 restarted.
        geofence_saved = save_geofence(
            session_id=session_id,
            center_lat=session["geofence_lat"],
            center_lon=session["geofence_lng"],
        )

        if not geofence_saved:
            ACTIVE_SESSION["id"] = None
            ACTIVE_SESSION["center_lat"] = 0.0
            ACTIVE_SESSION["center_lon"] = 0.0
            ACTIVE_SESSION["radius_m"] = 15
            ACTIVE_SESSION["is_open"] = False

            return False

        # Restore the same session into memory.
        ACTIVE_SESSION["id"] = session_id
        ACTIVE_SESSION["center_lat"] = session["geofence_lat"]
        ACTIVE_SESSION["center_lon"] = session["geofence_lng"]
        ACTIVE_SESSION["radius_m"] = session["geofence_radius"]
        ACTIVE_SESSION["is_open"] = True

        return True

    finally:
        conn.close()


# =========================
# REQUEST MODELS
# =========================

class StartGeofenceSessionRequest(BaseModel):
    center_lat: float
    center_lon: float

    # Classroom radius may be customized between
    # approximately 32 ft and 82 ft.
    radius_m: float = Field(ge=10, le=25)


class GeofenceCheckRequest(BaseModel):
    lat: float
    lon: float

    # GPS accuracy reported by the student's device.
    accuracy_m: float = Field(ge=0, le=20000)


# =========================
# GET ACTIVE SESSION
# =========================

@router.get("/session")
def get_active_geofence_session(
    current_user=Depends(get_current_user),
):
    return ACTIVE_SESSION


# =========================
# START SESSION
# =========================

@router.post("/session/start")
def start_geofence_session(
    payload: StartGeofenceSessionRequest,
    current_user=Depends(require_instructor),
):
    if ACTIVE_SESSION["is_open"]:
        raise HTTPException(
            status_code=409,
            detail="A session is already active",
        )

    # Store attendance session times in Central Time.
    now = datetime.now(CENTRAL_TZ)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Create the attendance session first so SQLite
        # generates the real session ID.
        cursor.execute(
            """
            INSERT INTO attendance_sessions (
                course_id,
                session_date,
                start_time,
                end_time,
                geofence_lat,
                geofence_lng,
                geofence_radius
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,  # CSCE 4901 prototype course
                now.strftime("%Y-%m-%d"),
                now.strftime("%H:%M:%S"),
                None,
                payload.center_lat,
                payload.center_lon,
                payload.radius_m,
            ),
        )

        session_id = cursor.lastrowid

        # Use the same session ID in Tile38.
        geofence_saved = save_geofence(
            session_id=str(session_id),
            center_lat=payload.center_lat,
            center_lon=payload.center_lon,
        )

        if not geofence_saved:
            raise RuntimeError(
                "Tile38 did not confirm geofence creation"
            )

        # Only save the SQLite session permanently if
        # Tile38 was also successfully configured.
        conn.commit()

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Could not start attendance session: {str(e)}",
        )

    finally:
        conn.close()

    # Only mark the session active after both SQLite
    # and Tile38 succeeded.
    ACTIVE_SESSION["id"] = str(session_id)
    ACTIVE_SESSION["center_lat"] = payload.center_lat
    ACTIVE_SESSION["center_lon"] = payload.center_lon
    ACTIVE_SESSION["radius_m"] = payload.radius_m
    ACTIVE_SESSION["is_open"] = True

    return {
        "message": "Geofence session started",
        "session": ACTIVE_SESSION,
        "engine": "tile38",
    }


# =========================
# END SESSION
# =========================

@router.post("/session/end")
def end_geofence_session(
    current_user=Depends(require_instructor),
):
    if not ACTIVE_SESSION["is_open"] or ACTIVE_SESSION["id"] is None:
        raise HTTPException(
            status_code=409,
            detail="No active session to end",
        )

    session_id = int(ACTIVE_SESSION["id"])

    # Store attendance session times in Central Time.
    now = datetime.now(CENTRAL_TZ)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE attendance_sessions
            SET end_time = ?
            WHERE session_id = ?
            """,
            (
                now.strftime("%H:%M:%S"),
                session_id,
            ),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Attendance session not found",
            )

        conn.commit()

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Could not end attendance session: {str(e)}",
        )

    finally:
        conn.close()

    ACTIVE_SESSION["is_open"] = False

    return {
        "message": "Geofence session ended",
        "session": ACTIVE_SESSION,
        "engine": "tile38",
    }


# =========================
# CHECK STUDENT LOCATION
# =========================

@router.post("/check")
def check_student_location(
    payload: GeofenceCheckRequest,
    current_user=Depends(get_current_user),
):
    if not ACTIVE_SESSION["is_open"]:
        return {
            "inside": False,
            "allow_biometric": False,
            "reason": "Session closed",
            "engine": "tile38",
        }

    # GPS accuracy is treated separately from
    # the instructor-selected classroom radius.
    #
    # Cap the additional tolerance at 10 meters
    # so poor GPS accuracy cannot turn a classroom
    # geofence into a building-sized geofence.
    accuracy_buffer_m = min(payload.accuracy_m, 10.0)

    allowed_radius_m = (
        ACTIVE_SESSION["radius_m"] + accuracy_buffer_m
    )

    # Tile38 is the authoritative geofence engine.
    # The frontend only receives the resulting
    # inside/outside decision.
    inside = check_geofence(
        session_id=ACTIVE_SESSION["id"],
        user_lat=payload.lat,
        user_lon=payload.lon,
        radius_m=allowed_radius_m,
    )

    return {
        "inside": inside,
        "allow_biometric": inside,
        "reason": (
            "Inside geofence"
            if inside
            else "Outside geofence"
        ),
        "radius_m": ACTIVE_SESSION["radius_m"],
        "accuracy_buffer_m": accuracy_buffer_m,
        "allowed_radius_m": allowed_radius_m,
        "engine": "tile38",
    }