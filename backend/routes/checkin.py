from fastapi import APIRouter, UploadFile, File, Form
from backend.database.db import get_db_connection
from backend.services.face import process_frame
from datetime import datetime

from routes.geofence import MOCK_SESSION

router = APIRouter()

# =========================
# CREATE SESSION
# =========================
@router.post("/session")
def create_session(data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
        INSERT INTO attendance_sessions 
        (course_id, session_date, start_time, end_time)
        VALUES (?, ?, ?, ?)
        """, (
            data.get("course_id"),
            data.get("session_date"),
            data.get("start_time"),
            data.get("end_time")
        ))

        conn.commit()
        session_id = cursor.lastrowid

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        conn.close()

    return {
        "success": True,
        "session_id": session_id
    }


# =========================
# CHECK-IN (CORE FEATURE)
# =========================
@router.post("/checkin")
async def checkin(
    user_id: int = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy: float = Form(...),
    file: UploadFile = File(...)
):
    if user_id is None:
        return {"success": False, "message": "Missing user_id"}

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # AUTO SESSION DETECTION
        cursor.execute("""
        SELECT session_id, session_date, start_time, end_time
        FROM attendance_sessions
        ORDER BY session_id DESC LIMIT 1
        """)

        session = cursor.fetchone()

        if not session:
            return {"success": False, "message": "No active session"}

        session_id = session["session_id"]

        # TIME VALIDATION
        now = datetime.now()

        session_date = session["session_date"]
        start_time = session["start_time"]
        end_time = session["end_time"]

        def parse_datetime(dt_str):
            try:
                 return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
            except:
                 return datetime.strptime(dt_str, "%Y-%m-%d %H:%M")


        start_datetime = parse_datetime(f"{session_date} {start_time}")
        end_datetime = parse_datetime(f"{session_date} {end_time}")


        if not (start_datetime <= now <= end_datetime):
            return {
                "success": False,
                "message": "Check-in not allowed outside session time"
            }

        # GEOFENCE VALIDATION - TILE38
        
        if not MOCK_SESSION["is_open"]:
            return{
                "success": False,
                "message": "Geofence session is closed"
            }

        accuracy_buffer_m = min(accuracy, 50.0)

        allowed_radius_m = (
            MOCK_SESSION["radius_m"] + accuracy_buffer_m
        )

        location_verified = check_geofence (
            session_id=MOCK_SESSION["id"],
            user_lat=latitude,
            user_lon=longitude,
            radius_m=allowed_radius_m,
        )

        if not location_verified:
            return {
                "success": False,
                "message": "Location outside allowed geofence",
                "allowed_radius_m": allowed_radius_m,
                "accuracy_m": accuracy,
                "engine": "tile38"
            }
        

        # FACE PROCESSING
        contents = await file.read()
        face_result = process_frame(contents)

        faces_detected = face_result.get("faces_detected", 0)
        confidence = face_result.get("confidence", 0)

        # SECURITY RULE
        if faces_detected != 1:
            return {
                "success": False,
                "message": "Invalid number of faces detected"
            }

        face_verified = confidence >= 0.75

        status = "present" if face_verified and location_verified else "flagged"

        # PREVENT DUPLICATE CHECK-IN
        cursor.execute("""
        SELECT * FROM attendance_records
        WHERE session_id = ? AND student_id = ?
        """, (session_id, user_id))

        existing = cursor.fetchone()

        if existing:
            return {
                "success": False,
                "message": "Already checked in"
            }

        # INSERT INTO DATABASE
        cursor.execute("""
        INSERT INTO attendance_records
        (session_id, student_id, face_verified, location_verified, status)
        VALUES (?, ?, ?, ?, ?)
        """, (
            session_id,
            user_id,
            int(face_verified),
            int(location_verified),
            status
        ))

        conn.commit()

    except Exception as e:
        return {"success": False, "error": str(e)}

    finally:
        conn.close()

    return {
        "success": True,
        "status": status,
        "confidence": confidence,
        "faces_detected": faces_detected,
        "location_verified": location_verified,
        "allowed_radius_m": allowed_radius_m,
        "accuracy_m": accuracy,
        "engine": "tile38"
    }


# =========================
# VIEW CHECK-INS
# =========================
@router.get("/checkins")
def get_checkins():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM attendance_records")
    records = cursor.fetchall()

    conn.close()

    return [dict(row) for row in records]
