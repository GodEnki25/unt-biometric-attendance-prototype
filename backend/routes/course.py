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
# STUDENT ATTENDANCE SUMMARY BY COURSE
# ============================================================

@router.get("/student/{course_id}/attendance-summary")
def get_student_attendance_summary(
    course_id: int,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        # --------------------------------------------------------
        # VERIFY STUDENT IS ENROLLED IN THIS COURSE
        # --------------------------------------------------------

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

        enrollment = cursor.fetchone()

        if not enrollment:
            return {
                "present": 0,
                "late": 0,
                "absent": 0,
                "total": 0,
                "percentage": 0,
            }


        # --------------------------------------------------------
        # TOTAL COMPLETED SESSIONS
        # --------------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM attendance_sessions
            WHERE course_id = ?
              AND end_time IS NOT NULL
            """,
            (course_id,),
        )

        total = (
            cursor.fetchone()["total"]
            or 0
        )


        # --------------------------------------------------------
        # PRESENT / LATE RECORDS
        # --------------------------------------------------------

        cursor.execute(
            """
            SELECT
                SUM(
                    CASE
                        WHEN ar.status = 'present'
                        THEN 1
                        ELSE 0
                    END
                ) AS present,

                SUM(
                    CASE
                        WHEN ar.status = 'late'
                        THEN 1
                        ELSE 0
                    END
                ) AS late

            FROM attendance_records ar

            JOIN attendance_sessions s
                ON s.session_id = ar.session_id

            WHERE s.course_id = ?
              AND ar.student_id = ?
              AND s.end_time IS NOT NULL
            """,
            (
                course_id,
                user_id,
            ),
        )

        row = cursor.fetchone()

        present = row["present"] or 0
        late = row["late"] or 0

        absent = max(
            total - present - late,
            0,
        )

        attended = (
            present
            + late
        )

        percentage = (
            round(
                attended / total * 100
            )
            if total > 0
            else 0
        )


        # --------------------------------------------------------
        # RETURN SUMMARY
        # --------------------------------------------------------

        return {
            "present": present,
            "late": late,
            "absent": absent,
            "total": total,
            "percentage": percentage,
        }

    finally:
        conn.close()