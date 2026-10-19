from fastapi import APIRouter, Depends

from backend.database.db import get_db_connection
from backend.services.token_service import (get_current_user, require_instructor)
from backend.routes.geofence import ACTIVE_SESSION

router = APIRouter (prefix="/courses", tags=["courses"],)

@router.get("")
def get_courses(current_user=Depends(require_instructor),):
    
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """ 
            SELECT
                course_id,
                course_code,
                course_name,
                instructor_id
            FROM courses
            ORDER BY course_code
            """
        )

        rows = cursor.fetchall()

        return[{
                "course_id": row["course_id"],
                "course_code": row["course_code"],
                "course_name": row["course_name"],
                "instructor_id": row["instructor_id"],
            }
            for row in rows
        ]

    finally:
        conn.close()

# ============================================================
# STUDENT COURSES / ACTIVE CLASS
# ============================================================
@router.get("/student")
def get_student_courses(
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    print("STUDENT DASHBOARD USER ID:", user_id)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # --------------------------------------------------------
        # GET COURSES THE STUDENT IS ENROLLED IN
        # --------------------------------------------------------

        cursor.execute(
            """
            SELECT
                c.course_id,
                c.course_code,
                c.course_name
            FROM course_enrollments ce
            JOIN courses c
                ON c.course_id = ce.course_id
            WHERE ce.student_id = ?
            ORDER BY c.course_code
            """,
            (user_id,),
        )

        courses = [
            dict(row)
            for row in cursor.fetchall()
        ]


        # --------------------------------------------------------
        # GET ACTIVE SESSION, IF IT BELONGS TO THIS STUDENT
        # --------------------------------------------------------

        active_session = None

        if (
            ACTIVE_SESSION["is_open"]
            and ACTIVE_SESSION["id"] is not None
        ):
            cursor.execute(
                """
                SELECT
                    s.session_id,
                    s.course_id,
                    s.session_date,
                    s.start_time,
                    s.end_time,
                    c.course_code,
                    c.course_name
                FROM attendance_sessions s
                JOIN courses c
                    ON c.course_id = s.course_id
                WHERE s.session_id = ?
                """,
                (
                    int(ACTIVE_SESSION["id"]),
                ),
            )

            session = cursor.fetchone()

            if session:
                enrolled_course_ids = {
                    course["course_id"]
                    for course in courses
                }

                if (
                    session["course_id"]
                    in enrolled_course_ids
                ):
                    active_session = dict(session)


        return {
            "courses": courses,
            "active_session": active_session,
        }

    finally:
        conn.close()

# ============================================================
# STUDENT ATTENDANCE HISTORY
# ============================================================

@router.get("/student/attendance-history")
def get_student_attendance_history(
    course_id: int | None = None,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # --------------------------------------------------------
        # VERIFY OPTIONAL COURSE ENROLLMENT
        # --------------------------------------------------------

        if course_id is not None:
            cursor.execute(
                """
                SELECT 1
                FROM course_enrollments
                WHERE course_id = ?
                  AND student_id = ?
                """,
                (
                    course_id,
                    user_id,
                ),
            )

            if not cursor.fetchone():
                return {
                    "records": [],
                    "summary": {
                        "present": 0,
                        "late": 0,
                        "absent": 0,
                        "percentage": 0,
                    },
                }

        # --------------------------------------------------------
        # LOAD STUDENT ATTENDANCE SESSIONS
        # --------------------------------------------------------

        query = """
            SELECT
                s.session_id,
                s.course_id,
                s.session_date,
                s.start_time,
                s.end_time,

                c.course_code,
                c.course_name,

                ar.attendance_id,
                ar.check_in_time,
                ar.face_verified,
                ar.location_verified,
                ar.status,

                (
                    SELECT g.event_time
                    FROM geofence_status_changes g
                    WHERE g.attendance_id =
                        ar.attendance_id
                      AND g.event_type = 'EXIT'
                    ORDER BY g.event_time DESC
                    LIMIT 1
                ) AS exit_time

            FROM attendance_sessions s

            JOIN courses c
                ON c.course_id =
                    s.course_id

            JOIN course_enrollments ce
                ON ce.course_id =
                    s.course_id
                AND ce.student_id = ?

            LEFT JOIN attendance_records ar
                ON ar.session_id =
                    s.session_id
                AND ar.student_id = ?

            WHERE
                (
                    s.end_time IS NOT NULL
                    OR
                    ar.attendance_id IS NOT NULL
                )
        """

        params = [
            user_id,
            user_id,
        ]

        if course_id is not None:
            query += """
                AND s.course_id = ?
            """

            params.append(
                course_id
            )

        query += """
            ORDER BY
                s.session_date DESC,
                s.start_time DESC
        """

        cursor.execute(
            query,
            params,
        )

        rows = cursor.fetchall()

        records = []

        present = 0
        late = 0
        absent = 0

        # --------------------------------------------------------
        # BUILD HISTORY RECORDS
        # --------------------------------------------------------

        for row in rows:
            if row["attendance_id"]:
                status = (
                    row["status"]
                    or "present"
                ).lower()

                if status == "late":
                    late += 1

                else:
                    present += 1

            else:
                status = "absent"
                absent += 1

            records.append({
                "session_id":
                    row["session_id"],

                "course_id":
                    row["course_id"],

                "course_code":
                    row["course_code"],

                "course_name":
                    row["course_name"],

                "session_date":
                    row["session_date"],

                "start_time":
                    row["start_time"],

                "end_time":
                    row["end_time"],

                "status":
                    status,

                "check_in_time":
                    row["check_in_time"],

                "exit_time":
                    row["exit_time"],

                "face_verified":
                    bool(
                        row["face_verified"]
                    )
                    if row["attendance_id"]
                    else False,

                "location_verified":
                    bool(
                        row["location_verified"]
                    )
                    if row["attendance_id"]
                    else False,
            })

        # --------------------------------------------------------
        # CALCULATE SUMMARY
        # --------------------------------------------------------

        total = (
            present
            + late
            + absent
        )

        attended = (
            present
            + late
        )

        percentage = (
            round(
                attended
                / total
                * 100
            )
            if total > 0
            else 0
        )

        return {
            "records": records,

            "summary": {
                "present":
                    present,

                "late":
                    late,

                "absent":
                    absent,

                "percentage":
                    percentage,
            },
        }

    finally:
        conn.close()