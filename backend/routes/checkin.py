from fastapi import APIRouter, UploadFile, File, Form, Depends
from backend.database.db import get_db_connection
from backend.services.face import process_frame
from datetime import datetime
from zoneinfo import ZoneInfo

CENTRAL_TZ = ZoneInfo("America/Chicago")

from backend.services.tile38_service import check_geofence
from backend.routes.geofence import ACTIVE_SESSION
from backend.services.token_service import get_current_user, require_instructor


router = APIRouter()


# =========================
# CREATE SESSION
# =========================

@router.post("/session")
def create_session(
    data: dict,
    current_user=Depends(require_instructor),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO attendance_sessions (
                course_id,
                session_date,
                start_time,
                end_time
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                data.get("course_id"),
                data.get("session_date"),
                data.get("start_time"),
                data.get("end_time"),
            ),
        )

        conn.commit()
        session_id = cursor.lastrowid

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }

    finally:
        conn.close()

    return {
        "success": True,
        "session_id": session_id,
    }


# =========================
# CHECK-IN (CORE FEATURE)
# =========================

@router.post("/checkin")
async def checkin(
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy: float = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # =========================
        # ACTIVE SESSION VALIDATION
        # =========================

        if not ACTIVE_SESSION["is_open"] or ACTIVE_SESSION["id"] is None:
            return {
                "success": False,
                "message": "No active session",
            }

        session_id = int(ACTIVE_SESSION["id"])

        cursor.execute(
            """
            SELECT session_id, session_date, start_time, end_time
            FROM attendance_sessions
            WHERE session_id = ?
            """,
            (session_id,),
        )

        session = cursor.fetchone()

        if not session:
            return {
                "success": False,
                "message": "Active session not found in database",
            }

        # =========================
        # TIME VALIDATION
        # =========================

        now = datetime.now(CENTRAL_TZ).replace(tzinfo=None)

        session_date = session["session_date"]
        start_time = session["start_time"]

        def parse_datetime(dt_str):
            try:
                return datetime.strptime(
                    dt_str,
                    "%Y-%m-%d %H:%M:%S",
                )
            except ValueError:
                return datetime.strptime(
                    dt_str,
                    "%Y-%m-%d %H:%M",
                )

        start_datetime = parse_datetime(
            f"{session_date} {start_time}"
        )

        if now < start_datetime:
            return {
                "success": False,
                "message": "Check-in not allowed before session start",
            }

        # =========================
        # GEOFENCE VALIDATION
        # =========================

        accuracy_buffer_m = min(accuracy, 10.0)

        allowed_radius_m = (
            ACTIVE_SESSION["radius_m"] + accuracy_buffer_m
        )

        location_verified = check_geofence(
            session_id=ACTIVE_SESSION["id"],
            user_lat=latitude,
            user_lon=longitude,
            radius_m=allowed_radius_m,
        )

        if not location_verified:
            return {
                "success": False,
                "message": "Student is outside the allowed geofence",
                "location_verified": False,
                "radius_m": ACTIVE_SESSION["radius_m"],
                "accuracy_buffer_m": accuracy_buffer_m,
                "allowed_radius_m": allowed_radius_m,
            }

        # =========================
        # FACE VALIDATION
        # =========================

        contents = await file.read()
        face_result = process_frame(contents)

        faces_detected = face_result.get("faces_detected", 0)
        confidence = face_result.get("confidence", 0)

        if faces_detected != 1:
            return {
                "success": False,
                "message": "Exactly one face must be detected",
                "faces_detected": faces_detected,
            }

        face_verified = confidence >= 0.75

        if not face_verified:
            return {
                "success": False,
                "message": "Face verification failed",
                "face_verified": False,
                "confidence": confidence,
            }

        # =========================
        # DUPLICATE CHECK
        # =========================

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

        existing_record = cursor.fetchone()

        if existing_record:
            return {
                "success": False,
                "message": "Student already checked in for this session",
            }

        # =========================
        # SAVE ATTENDANCE
        # =========================

        status = "present"

        check_in_time = datetime.now(CENTRAL_TZ).strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        cursor.execute(
            """
            INSERT INTO attendance_records (
                session_id,
                student_id,
                check_in_time,
                face_verified,
                location_verified,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                user_id,
                check_in_time,
                1,
                1,
                status,
            ),
        )

        attendance_id = cursor.lastrowid

        #==============================
        # INITIAL GEOFENCE EVENT
        #==============================
        # A sucessfull attendance check-in can only occur while
        # the student is inside the active classroom geofence.
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
                "ENTER",
                check_in_time,
            ),
        )

        conn.commit()

        return {
            "success": True,
            "message": "Attendance recorded successfully",
            "session_id": session_id,
            "student_id": user_id,
            "status": status,
            "face_verified": True,
            "location_verified": True,
            "confidence": confidence,
            "faces_detected": faces_detected,
            "radius_m": ACTIVE_SESSION["radius_m"],
            "accuracy_buffer_m": accuracy_buffer_m,
            "allowed_radius_m": allowed_radius_m,
            "engine": "tile38",
        }

    except Exception as e:
        conn.rollback()

        return {
            "success": False,
            "error": str(e),
        }

    finally:
        conn.close()


# =========================
# GET CHECK-INS
# =========================

@router.get("/checkins")
def get_checkins(
    current_user=Depends(require_instructor),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # If a class is currently running, show attendance
        # for that exact session.
        if ACTIVE_SESSION["is_open"] and ACTIVE_SESSION["id"] is not None:
            session_id = int(ACTIVE_SESSION["id"])

        else:
            # If the class has ended, show attendance from
            # the most recently created session.
            cursor.execute(
                """
                SELECT session_id
                FROM attendance_sessions
                WHERE course_id = 1
                ORDER BY session_id DESC
                LIMIT 1
                """
            )

            session = cursor.fetchone()

            if not session:
                return []

            session_id = session["session_id"]

        # Get every enrolled student and their attendance
        # record for this specific session only.
        #
        # Keep the same response format expected by the
        # instructor dashboard and override screen.
        cursor.execute(
            """
            SELECT
                u.user_id AS student_id,
                u.full_name AS student_name,
                ar.attendance_id,
                ar.session_id,
                ar.check_in_time,
                ar.face_verified,
                ar.location_verified,
                CASE
                    WHEN ar.attendance_id IS NULL THEN 'absent'
                    ELSE ar.status
                END AS status
            FROM course_enrollments ce
            JOIN users u
                ON u.user_id = ce.student_id
            LEFT JOIN attendance_records ar
                ON ar.student_id = u.user_id
                AND ar.session_id = ?
            WHERE ce.course_id = 1
                AND u.role = 'student'
            ORDER BY u.full_name
            """,
            (session_id,),
        )

        records = cursor.fetchall()

        return [dict(row) for row in records]

    finally:
        conn.close()