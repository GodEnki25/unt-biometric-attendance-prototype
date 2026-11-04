
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, UploadFile, File, Form, Depends

from backend.database.db import get_db_connection
from backend.services.tile38_service import check_geofence
from backend.routes.geofence import ACTIVE_SESSION
from backend.services.token_service import get_current_user, require_instructor
from biometrics.backend.api import consume_verification


router = APIRouter()
CENTRAL_TZ = ZoneInfo("America/Chicago")


def calculate_attendance_times(cursor, attendance_id, session_end=None):
    if attendance_id is None:
        return {
            "first_check_in_time": None,
            "latest_entry_time": None,
            "latest_exit_time": None,
            "total_time": None,
        }

    cursor.execute(
        """
        SELECT event_type, event_time
        FROM geofence_status_changes
        WHERE attendance_id = ?
        ORDER BY event_time ASC, status_change_id ASC
        """,
        (attendance_id,),
    )

    events = cursor.fetchall()

    first_entry = None
    latest_entry = None
    latest_exit = None
    inside_since = None
    total_seconds = 0

    for event in events:
        event_type = event["event_type"]
        event_time = datetime.strptime(
            event["event_time"], "%Y-%m-%d %H:%M:%S"
        )

        if event_type in ("ENTER", "REENTER"):
            if first_entry is None:
                first_entry = event["event_time"]

            if inside_since is None:
                inside_since = event_time

            latest_entry = event["event_time"]

        elif event_type == "EXIT":
            if inside_since is not None:
                total_seconds += max(
                    0, (event_time - inside_since).total_seconds()
                )
                inside_since = None

            latest_exit = event["event_time"]

    if inside_since is not None:
        end = session_end or datetime.now(
            CENTRAL_TZ
        ).replace(tzinfo=None)

        total_seconds += max(
            0, (end - inside_since).total_seconds()
        )

    total_seconds = int(total_seconds)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    return {
        "first_check_in_time": first_entry,
        "latest_entry_time": latest_entry,
        "latest_exit_time": latest_exit,
        "total_time": f"{hours:02d}:{minutes:02d}:{seconds:02d}",
    }


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

        return {
            "success": True,
            "session_id": cursor.lastrowid,
        }

    except Exception as error:
        conn.rollback()

        return {
            "success": False,
            "error": str(error),
        }

    finally:
        conn.close()


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
        if (
            not ACTIVE_SESSION["is_open"]
            or ACTIVE_SESSION["id"] is None
        ):
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

        now = datetime.now(
            CENTRAL_TZ
        ).replace(tzinfo=None)

        session_date = session["session_date"]
        start_time = session["start_time"]

        def parse_datetime(dt_str):
            try:
                return datetime.strptime(
                    dt_str, "%Y-%m-%d %H:%M:%S"
                )
            except ValueError:
                return datetime.strptime(
                    dt_str, "%Y-%m-%d %H:%M"
                )

        start_datetime = parse_datetime(
            f"{session_date} {start_time}"
        )

        if now < start_datetime:
            return {
                "success": False,
                "message": "Check-in not allowed before session start",
            }

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

        # Face recognition and liveness must both be completed.
        # The authorization expires after 30 seconds and is
        # consumed once, preventing reuse for another check-in.

        if not consume_verification(user_id):
            return {
                "success": False,
                "message": "Face and liveness verification required or expired",
                "face_verified": False,
            }

        cursor.execute(
            """
            SELECT attendance_id
            FROM attendance_records
            WHERE session_id = ?
              AND student_id = ?
            """,
            (session_id, user_id),
        )

        if cursor.fetchone():
            return {
                "success": False,
                "message": "Student already checked in for this session",
            }

        status = "present"

        check_in_time = datetime.now(
            CENTRAL_TZ
        ).strftime("%Y-%m-%d %H:%M:%S")

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
            "radius_m": ACTIVE_SESSION["radius_m"],
            "accuracy_buffer_m": accuracy_buffer_m,
            "allowed_radius_m": allowed_radius_m,
            "engine": "tile38",
        }

    except Exception as error:
        conn.rollback()

        return {
            "success": False,
            "error": str(error),
        }

    finally:
        await file.close()
        conn.close()


@router.get("/checkins")
def get_checkins(
    current_user=Depends(require_instructor),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if (
            ACTIVE_SESSION["is_open"]
            and ACTIVE_SESSION["id"] is not None
        ):
            session_id = int(ACTIVE_SESSION["id"])

        else:
            cursor.execute(
                """
                SELECT session_id
                FROM attendance_sessions
                ORDER BY session_id DESC
                LIMIT 1
                """
            )

            session = cursor.fetchone()

            if not session:
                return []

            session_id = session["session_id"]

        cursor.execute(
            """
            SELECT course_id
            FROM attendance_sessions
            WHERE session_id = ?
            """,
            (session_id,),
        )

        session_course = cursor.fetchone()

        if not session_course:
            return []

        course_id = session_course["course_id"]

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
            WHERE ce.course_id = ?
              AND u.role = 'student'
            ORDER BY u.full_name
            """,
            (session_id, course_id),
        )

        records = cursor.fetchall()

        cursor.execute(
            """
            SELECT session_date, end_time
            FROM attendance_sessions
            WHERE session_id = ?
            """,
            (session_id,),
        )

        session = cursor.fetchone()
        session_end = None

        if session and session["end_time"]:
            session_end = datetime.strptime(
                f'{session["session_date"]} {session["end_time"]}',
                "%Y-%m-%d %H:%M:%S",
            )

        results = []

        for row in records:
            record = dict(row)

            record.update(
                calculate_attendance_times(
                    cursor,
                    record["attendance_id"],
                    session_end,
                )
            )

            results.append(record)

        return results

    finally:
        conn.close()


@router.get("/checkin/status")
def get_checkin_status(
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    if (
        not ACTIVE_SESSION["is_open"]
        or ACTIVE_SESSION["id"] is None
    ):
        return {
            "checked_in": False
        }

    session_id = int(ACTIVE_SESSION["id"])

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT
                attendance_id,
                check_in_time,
                status
            FROM attendance_records
            WHERE session_id = ?
              AND student_id = ?
            LIMIT 1
            """,
            (session_id, user_id),
        )

        record = cursor.fetchone()

        if not record:
            return {
                "checked_in": False
            }

        return {
            "checked_in": True,
            "attendance_id": record["attendance_id"],
            "check_in_time": record["check_in_time"],
            "status": record["status"],
        }

    finally:
        conn.close()


@router.get("/attendance/override/{student_id}")
def get_attendance_override_details(
    student_id: int,
    current_user=Depends(require_instructor),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if (
            ACTIVE_SESSION["is_open"]
            and ACTIVE_SESSION["id"] is not None
        ):
            session_id = int(ACTIVE_SESSION["id"])

        else:
            cursor.execute(
                """
                SELECT session_id
                FROM attendance_sessions
                ORDER BY session_id DESC
                LIMIT 1
                """
            )

            session = cursor.fetchone()

            if not session:
                return {
                    "success": False,
                    "message": "No attendance session found.",
                }

            session_id = session["session_id"]

        cursor.execute(
            """
            SELECT
                s.session_id,
                s.session_date,
                c.course_id,
                c.course_code,
                c.course_name,
                u.user_id AS student_id,
                u.full_name AS student_name,
                ar.attendance_id,
                ar.check_in_time,
                ar.face_verified,
                ar.location_verified,
                CASE
                    WHEN ar.attendance_id IS NULL THEN 'absent'
                    ELSE ar.status
                END AS status
            FROM attendance_sessions s
            JOIN courses c
                ON c.course_id = s.course_id
            JOIN course_enrollments ce
                ON ce.course_id = s.course_id
            JOIN users u
                ON u.user_id = ce.student_id
            LEFT JOIN attendance_records ar
                ON ar.session_id = s.session_id
                AND ar.student_id = u.user_id
            WHERE s.session_id = ?
              AND u.user_id = ?
              AND u.role = 'student'
            LIMIT 1
            """,
            (session_id, student_id),
        )

        record = cursor.fetchone()

        if not record:
            return {
                "success": False,
                "message": "Student attendance record not found.",
            }

        attendance_id = record["attendance_id"]
        events = []

        if attendance_id is not None:
            cursor.execute(
                """
                SELECT event_type, event_time
                FROM geofence_status_changes
                WHERE attendance_id = ?
                ORDER BY event_time ASC
                """,
                (attendance_id,),
            )

            events = [
                {
                    "event_type": row["event_type"],
                    "event_time": row["event_time"],
                }
                for row in cursor.fetchall()
            ]

        return {
            "success": True,
            "student": {
                "student_id": record["student_id"],
                "student_name": record["student_name"],
            },
            "course": {
                "course_id": record["course_id"],
                "course_code": record["course_code"],
                "course_name": record["course_name"],
            },
            "session": {
                "session_id": record["session_id"],
                "session_date": record["session_date"],
            },
            "attendance": {
                "attendance_id": attendance_id,
                "status": record["status"],
                "check_in_time": record["check_in_time"],
                "face_verified": (
                    bool(record["face_verified"])
                    if attendance_id is not None
                    else False
                ),
                "location_verified": (
                    bool(record["location_verified"])
                    if attendance_id is not None
                    else False
                ),
            },
            "events": events,
        }

    finally:
        conn.close()


@router.post("/attendance/override")
def save_attendance_override(
    data: dict,
    current_user=Depends(require_instructor),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        session_id = data.get("session_id")
        student_id = data.get("student_id")
        status = (data.get("status") or "").lower()

        if session_id is None or student_id is None:
            return {
                "success": False,
                "message": "Session and student are required.",
            }

        allowed_statuses = {
            "present",
            "late",
            "excused",
            "absent",
        }

        if status not in allowed_statuses:
            return {
                "success": False,
                "message": "Invalid attendance status.",
            }

        cursor.execute(
            """
            SELECT 1
            FROM attendance_sessions s
            JOIN course_enrollments ce
                ON ce.course_id = s.course_id
            WHERE s.session_id = ?
              AND ce.student_id = ?
            """,
            (session_id, student_id),
        )

        if not cursor.fetchone():
            return {
                "success": False,
                "message": "Student is not enrolled in this session's course.",
            }

        cursor.execute(
            """
            SELECT attendance_id
            FROM attendance_records
            WHERE session_id = ?
              AND student_id = ?
            LIMIT 1
            """,
            (session_id, student_id),
        )

        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """
                UPDATE attendance_records
                SET status = ?
                WHERE attendance_id = ?
                """,
                (status, existing["attendance_id"]),
            )

        elif status == "absent":
            conn.commit()

            return {
                "success": True,
                "message": "Attendance remains absent.",
                "status": status,
            }

        else:
            override_time = datetime.now(
                CENTRAL_TZ
            ).strftime("%Y-%m-%d %H:%M:%S")

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
                    student_id,
                    override_time,
                    0,
                    0,
                    status,
                ),
            )

        conn.commit()

        return {
            "success": True,
            "message": "Attendance override saved.",
            "status": status,
        }

    except Exception as error:
        conn.rollback()

        return {
            "success": False,
            "message": str(error),
        }

    finally:
        conn.close()
