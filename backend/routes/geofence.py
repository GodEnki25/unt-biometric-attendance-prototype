from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.database.db import get_db_connection
from backend.services.tile38_service import save_geofence, check_geofence, delete_geofence
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

#Student presnece confirmation state.
#
# Raw GPS samples are never stored here or in SQLite.
# This only tracks enough temporary state to confirm
# meaningful INSIDE / OUTSIDE transitions.
PRESENCE_TRACKER = {}

CONFIRMATION_CHECKS = 3

def get_confirmed_presence_state(attendance_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT event_type
            FROM geofence_status_changes
            WHERE attendance_id = ?
            ORDER BY status_change_id DESC
            LIMIT 1
            """,
            (attendance_id,),
        )

        event = cursor.fetchone()

        if not event:
            return "INSIDE"

        if event["event_type"] == "EXIT":
            return "OUTSIDE"

        return "INSIDE"

    finally:
        conn.close()


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
    course_id: int
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
                payload.course_id,
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

    # Clear in-memory presence tracking for all students in this session.

    tracker_keys_to_remove = [
        key for key in PRESENCE_TRACKER.keys()
        if key[0] == session_id
    ]     
    for key in tracker_keys_to_remove:
        del PRESENCE_TRACKER[key]

    # Remove the ended session's geofence from Tile38.
    delete_geofence(session_id=ACTIVE_SESSION["id"])    

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

    # 1. Tile38 calculates raw inside/outside
    inside = check_geofence(
        session_id=ACTIVE_SESSION["id"],
        user_lat=payload.lat,
        user_lon=payload.lon,
        radius_m=allowed_radius_m,
    )

    # Find this student's attendance record
    user_id = current_user["user_id"]
    session_id = int(ACTIVE_SESSION["id"])

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Presence events are only tracked after a student
        # has successfully completed attendance check-in.
        cursor.execute(
            """
            SELECT attendance_id
            FROM attendance_records
            WHERE session_id = ?
                AND student_id = ?
            """,
            (
                session_id,
                user_id,
            ),
        )

        attendance = cursor.fetchone()

    finally:
        conn.close()

    # 3. Student has not checked in yet.
    # Return noraml geofence result so biometrics can still be enabled.
    if not attendance:
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
            "presence_tracking": False,
            "engine": "tile38",
        }

    #4. Student HAS checked in.
    # Begin presence tracking
    attendance_id = attendance["attendance_id"]

    tracker_key = (
        session_id,
        user_id,
    )

    if tracker_key not in PRESENCE_TRACKER:
        PRESENCE_TRACKER[tracker_key] = {
            "confirmed_state":
                get_confirmed_presence_state(attendance_id),
            "candidate_state": None,
            "candidate_count": 0
        }

    tracker = PRESENCE_TRACKER[tracker_key]

    raw_state = (
        "INSIDE"
        if inside
        else "OUTSIDE"
    )


    event_type = None
    state_changed = False

    # GPS agrees with the already confirmed state
    # Clear any temp candidate transition.
    if raw_state == tracker["confirmed_state"]:

        tracker["candidate_state"] = None
        tracker["candidate_count"] = 0

    else:

        # Continue counting the same candidate state.
        if(tracker["candidate_state"] == raw_state):
            tracker["candidate_count"] += 1

        else:
            # A different possible state change began
            tracker["candidate_state"] = raw_state
            tracker["candidate_count"] = 1


        # Only commit the change after three
        # consecutive matching Tile38 results.
        if(tracker["candidate_count"] >= CONFIRMATION_CHECKS):
            previous_state = (tracker["confirmed_state"])
            
            tracker["confirmed_state"] = (raw_state)

            tracker["candidate_state"] = None
            tracker["candidate_count"] = 0

            if(previous_state == "INSIDE" and raw_state == "OUTSIDE"):
                event_type = "EXIT"

            elif(previous_state == "OUTSIDE" and raw_state == "INSIDE"):
                event_type = "REENTER"

            state_changed = (event_type is not None)

        if state_changed:
            event_time = datetime.now(
                CENTRAL_TZ
            ).strftime(
                "%Y-%m-%d %H:%M:%S"
            )

            conn = get_db_connection()
            cursor = conn.cursor()

            try:
                cursor.execute(
                """
                INSERT INTO geofence_status_changes (
                    attendance_id,
                    event_type,
                    event_time
                )
                VALUES (?, ?, ?)
                """,
                (
                    attendance_id,
                    event_type,
                    event_time,
                ),
            )

                conn.commit()

            finally:
                conn.close()

    return {

        "inside": inside,
        "allow_biometric": inside,
        "confirmed_state": tracker["confirmed_state"],
        "candidate_state": tracker["candidate_state"],
        "candidate_count": tracker["candidate_count"],
        "state_changed": state_changed,
        "event_type": event_type,
        "radius_m": ACTIVE_SESSION["radius_m"],
        "accuracy_buffer_m": accuracy_buffer_m,
        "allowed_radius_m": allowed_radius_m,
        "presence_tracking": True,
        "engine": "tile38",
    }
