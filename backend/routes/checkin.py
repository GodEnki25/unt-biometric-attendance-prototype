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


def calculate_attendance_times(
    cursor,
    attendance_id,
    session_end=None,
    session_is_active=False,
):
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
            event["event_time"],
            "%Y-%m-%d %H:%M:%S",
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
                    0,
                    (
                        event_time -
                        inside_since
                    ).total_seconds(),
                )

                inside_since = None

            latest_exit = event["event_time"]

    # If the student was still marked inside at the end
    # of the recorded events, only continue counting when
    # we have a trustworthy endpoint.
    #
    # Completed session:
    #   use the stored session end time.
    #
    # Genuinely active session:
    #   continue counting through the current time.
    #
    # Incomplete/stale session:
    #   do NOT assume the student remained inside forever.
    if inside_since is not None:

        if session_end is not None:
            total_seconds += max(
                0,
                (
                    session_end -
                    inside_since
                ).total_seconds(),
            )

        elif session_is_active:
            now = datetime.now(
                CENTRAL_TZ
            ).replace(tzinfo=None)

            total_seconds += max(
                0,
                (
                    now -
                    inside_since
                ).total_seconds(),
            )

    total_seconds = int(total_seconds)

    hours, remainder = divmod(
        total_seconds,
        3600,
    )

    minutes, seconds = divmod(
        remainder,
        60,
    )

    return {
        "first_check_in_time": first_entry,
        "latest_entry_time": latest_entry,
        "latest_exit_time": latest_exit,
        "total_time":
            f"{hours:02d}:{minutes:02d}:{seconds:02d}",
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

        session_id = int(
            ACTIVE_SESSION["id"]
        )

        cursor.execute(
            """
            SELECT
                session_id,
                session_date,
                start_time,
                end_time
            FROM attendance_sessions
            WHERE session_id = ?
            """,
            (session_id,),
        )

        session = cursor.fetchone()

        if not session:
            return {
                "success": False,
                "message":
                    "Active session not found in database",
            }

        now = datetime.now(
            CENTRAL_TZ
        ).replace(tzinfo=None)

        session_date = session[
            "session_date"
        ]

        start_time = session[
            "start_time"
        ]

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
                "message":
                    "Check-in not allowed before session start",
            }

        accuracy_buffer_m = min(
            accuracy,
            10.0,
        )

        allowed_radius_m = (
            ACTIVE_SESSION["radius_m"] +
            accuracy_buffer_m
        )

        location_verified = check_geofence(
            session_id=
                ACTIVE_SESSION["id"],
            user_lat=latitude,
            user_lon=longitude,
            radius_m=allowed_radius_m,
        )

        if not location_verified:
            return {
                "success": False,
                "message":
                    "Student is outside the allowed geofence",
                "location_verified": False,
                "radius_m":
                    ACTIVE_SESSION["radius_m"],
                "accuracy_buffer_m":
                    accuracy_buffer_m,
                "allowed_radius_m":
                    allowed_radius_m,
            }

        # Face recognition and liveness must both be completed.
        # The authorization expires after 30 seconds and is
        # consumed once, preventing reuse for another check-in.

        if not consume_verification(
            user_id
        ):
            return {
                "success": False,
                "message":
                    "Face and liveness verification required or expired",
                "face_verified": False,
            }

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

        if cursor.fetchone():
            return {
                "success": False,
                "message":
                    "Student already checked in for this session",
            }

        status = "present"

        check_in_time = datetime.now(
            CENTRAL_TZ
        ).strftime(
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

        attendance_id = (
            cursor.lastrowid
        )

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
            "message":
                "Attendance recorded successfully",
            "session_id": session_id,
            "student_id": user_id,
            "status": status,
            "face_verified": True,
            "location_verified": True,
            "radius_m":
                ACTIVE_SESSION["radius_m"],
            "accuracy_buffer_m":
                accuracy_buffer_m,
            "allowed_radius_m":
                allowed_radius_m,
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


# =========================
# GET CHECK-INS
# =========================

@router.get("/checkins")
def get_checkins(
    course_id: int | None = None,
    current_user=Depends(
        require_instructor
    ),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # ======================================================
        # GET LATEST SESSION FOR THE SELECTED COURSE
        # ======================================================

        if course_id is None:
            return []

        cursor.execute(
            """
            SELECT session_id
            FROM attendance_sessions
            WHERE course_id = ?
            ORDER BY session_id DESC
            LIMIT 1
            """,
            (course_id,),
        )

        session = cursor.fetchone()

        if not session:
            return []

        session_id = session[
            "session_id"
        ]

        cursor.execute(
            """
            SELECT
                u.user_id AS user_id,
                u.student_id AS student_id,
                u.full_name AS student_name,
                ar.attendance_id,
                ar.session_id,
                ar.check_in_time,
                ar.face_verified,
                ar.location_verified,
                ar.notes,

                CASE
                    WHEN ar.attendance_id IS NULL
                        THEN 'absent'
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
            (
                session_id,
                course_id,
            ),
        )

        records = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                session_id,
                session_date,
                end_time
            FROM attendance_sessions
            WHERE session_id = ?
            """,
            (session_id,),
        )

        session = cursor.fetchone()

        session_end = None

        session_is_active = (
            session is not None
            and ACTIVE_SESSION[
                "is_open"
            ]
            and ACTIVE_SESSION[
                "id"
            ] is not None
            and int(
                ACTIVE_SESSION[
                    "id"
                ]
            ) == int(
                session[
                    "session_id"
                ]
            )
        )

        if (
            session
            and session["end_time"]
        ):
            session_end = (
                datetime.strptime(
                    (
                        f'{session["session_date"]} '
                        f'{session["end_time"]}'
                    ),
                    "%Y-%m-%d %H:%M:%S",
                )
            )

        results = []

        for row in records:
            record = dict(row)

            record.update(
                calculate_attendance_times(
                    cursor,
                    record[
                        "attendance_id"
                    ],
                    session_end,
                    session_is_active,
                )
            )

            results.append(
                record
            )

        return results

    finally:
        conn.close()


# ============================================================
# INSTRUCTOR SESSION HISTORY
# ============================================================

def format_session_duration(
    session_id,
    session_date,
    start_time,
    end_time,
):
    if (
        not session_date
        or not start_time
    ):
        return None

    try:
        start = datetime.strptime(
            (
                f"{session_date} "
                f"{start_time}"
            ),
            "%Y-%m-%d %H:%M:%S",
        )

        if end_time:
            end = datetime.strptime(
                (
                    f"{session_date} "
                    f"{end_time}"
                ),
                "%Y-%m-%d %H:%M:%S",
            )

        elif (
            ACTIVE_SESSION["is_open"]
            and ACTIVE_SESSION[
                "id"
            ] is not None
            and int(
                ACTIVE_SESSION[
                    "id"
                ]
            ) == int(
                session_id
            )
        ):
            end = datetime.now(
                CENTRAL_TZ
            ).replace(
                tzinfo=None
            )

        else:
            # Session was never properly ended and is
            # not the currently active backend session.
            return None

        total_seconds = max(
            0,
            int(
                (
                    end -
                    start
                ).total_seconds()
            ),
        )

        hours, remainder = divmod(
            total_seconds,
            3600,
        )

        minutes = (
            remainder // 60
        )

        if hours > 0:
            return (
                f"{hours} hr "
                f"{minutes} min"
            )

        return f"{minutes} min"

    except (
        ValueError,
        TypeError,
    ):
        return None


def get_session_status(
    session_id,
    end_time,
):
    if end_time:
        return "completed"

    if (
        ACTIVE_SESSION["is_open"]
        and ACTIVE_SESSION[
            "id"
        ] is not None
        and int(
            ACTIVE_SESSION[
                "id"
            ]
        ) == int(
            session_id
        )
    ):
        return "active"

    return "incomplete"


@router.get(
    "/attendance/session-history"
)
def get_instructor_session_history(
    current_user=Depends(
        require_instructor
    ),
):
    instructor_id = current_user[
        "user_id"
    ]

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT
                s.session_id,
                s.course_id,
                c.course_code,
                c.course_name,
                s.room,
                s.session_date,
                s.start_time,
                s.end_time,

                COUNT(
                    DISTINCT sr.student_id
                ) AS enrolled_count,

                COUNT(
                    DISTINCT CASE
                        WHEN ar.attendance_id IS NOT NULL
                        AND LOWER(
                            COALESCE(
                                ar.status,
                                'absent'
                            )
                        ) != 'absent'
                        THEN ar.student_id
                    END
                ) AS attendance_count

            FROM attendance_sessions s

            JOIN courses c
                ON c.course_id = s.course_id

            LEFT JOIN session_roster sr
                ON sr.session_id = s.session_id

            LEFT JOIN attendance_records ar
                ON ar.session_id = s.session_id
                AND ar.student_id = sr.student_id

            WHERE c.instructor_id = ?

            GROUP BY
                s.session_id,
                s.course_id,
                c.course_code,
                c.course_name,
                s.room,
                s.session_date,
                s.start_time,
                s.end_time

            ORDER BY
                s.session_date DESC,
                s.start_time DESC,
                s.session_id DESC
            """,
            (instructor_id,),
        )

        rows = cursor.fetchall()

        results = []

        for row in rows:
            results.append(
                {
                    "session_id":
                        row[
                            "session_id"
                        ],

                    "course_id":
                        row[
                            "course_id"
                        ],

                    "course_code":
                        row[
                            "course_code"
                        ],

                    "course_name":
                        row[
                            "course_name"
                        ],

                    "room":
                        row[
                            "room"
                        ],

                    "session_date":
                        row[
                            "session_date"
                        ],

                    "start_time":
                        row[
                            "start_time"
                        ],

                    "end_time":
                        row[
                            "end_time"
                        ],

                    "duration":
                        format_session_duration(
                            row[
                                "session_id"
                            ],
                            row[
                                "session_date"
                            ],
                            row[
                                "start_time"
                            ],
                            row[
                                "end_time"
                            ],
                        ),

                    "attendance_count":
                        row[
                            "attendance_count"
                        ],

                    "enrolled_count":
                        row[
                            "enrolled_count"
                        ],

                    "status":
                        get_session_status(
                            row[
                                "session_id"
                            ],
                            row[
                                "end_time"
                            ],
                        ),
                }
            )

        return results

    finally:
        conn.close()


@router.get(
    "/attendance/session-history/{session_id}"
)
def get_instructor_session_history_details(
    session_id: int,
    current_user=Depends(
        require_instructor
    ),
):
    instructor_id = current_user[
        "user_id"
    ]

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT
                s.session_id,
                s.course_id,
                s.room,
                s.session_date,
                s.start_time,
                s.end_time,
                c.course_code,
                c.course_name

            FROM attendance_sessions s

            JOIN courses c
                ON c.course_id = s.course_id

            WHERE s.session_id = ?
              AND c.instructor_id = ?

            LIMIT 1
            """,
            (
                session_id,
                instructor_id,
            ),
        )

        session = (
            cursor.fetchone()
        )

        if not session:
            return {
                "success": False,
                "message":
                    "Session not found.",
            }

        session_end = None

        if session["end_time"]:
            session_end = (
                datetime.strptime(
                    (
                        f'{session["session_date"]} '
                        f'{session["end_time"]}'
                    ),
                    "%Y-%m-%d %H:%M:%S",
                )
            )

        cursor.execute(
            """
            SELECT
                u.user_id,
                u.student_id,
                u.full_name,

                ar.attendance_id,
                ar.check_in_time,
                ar.face_verified,
                ar.location_verified,
                ar.notes,

                CASE
                    WHEN ar.attendance_id IS NULL
                        THEN 'absent'
                    ELSE ar.status
                END AS status

            FROM session_roster sr

            JOIN users u
                ON u.user_id = sr.student_id

            LEFT JOIN attendance_records ar
                ON ar.student_id = u.user_id
                AND ar.session_id = ?

            WHERE sr.session_id = ?
              AND u.role = 'student'

            ORDER BY u.full_name
            """,
            (
                session_id,
                session_id,
            ),
        )

        session_is_active = (
            ACTIVE_SESSION[
                "is_open"
            ]
            and ACTIVE_SESSION[
                "id"
            ] is not None
            and int(
                ACTIVE_SESSION[
                    "id"
                ]
            ) == int(
                session[
                    "session_id"
                ]
            )
        )

        students = []

        for row in cursor.fetchall():
            attendance_times = (
                calculate_attendance_times(
                    cursor,
                    row[
                        "attendance_id"
                    ],
                    session_end,
                    session_is_active,
                )
            )

            students.append(
                {
                    "user_id":
                        row[
                            "user_id"
                        ],

                    "student_id":
                        row[
                            "student_id"
                        ],

                    "student_name":
                        row[
                            "full_name"
                        ],

                    "status":
                        row[
                            "status"
                        ],

                    "check_in_time":
                        row[
                            "check_in_time"
                        ],

                    "face_verified":
                        bool(
                            row[
                                "face_verified"
                            ]
                        )
                        if row[
                            "attendance_id"
                        ] is not None
                        else False,

                    "location_verified":
                        bool(
                            row[
                                "location_verified"
                            ]
                        )
                        if row[
                            "attendance_id"
                        ] is not None
                        else False,

                    "notes":
                        row[
                            "notes"
                        ],

                    **attendance_times,
                }
            )

        return {
            "success": True,

            "session": {
                "session_id":
                    session[
                        "session_id"
                    ],

                "course_id":
                    session[
                        "course_id"
                    ],

                "course_code":
                    session[
                        "course_code"
                    ],

                "course_name":
                    session[
                        "course_name"
                    ],

                "room":
                    session[
                        "room"
                    ],

                "session_date":
                    session[
                        "session_date"
                    ],

                "start_time":
                    session[
                        "start_time"
                    ],

                "end_time":
                    session[
                        "end_time"
                    ],

                "duration":
                    format_session_duration(
                        session[
                            "session_id"
                        ],
                        session[
                            "session_date"
                        ],
                        session[
                            "start_time"
                        ],
                        session[
                            "end_time"
                        ],
                    ),
            },

            "students":
                students,
        }

    finally:
        conn.close()


@router.get("/checkin/status")
def get_checkin_status(
    current_user=Depends(
        get_current_user
    ),
):
    user_id = current_user[
        "user_id"
    ]

    if (
        not ACTIVE_SESSION[
            "is_open"
        ]
        or ACTIVE_SESSION[
            "id"
        ] is None
    ):
        return {
            "checked_in": False
        }

    session_id = int(
        ACTIVE_SESSION["id"]
    )

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
            (
                session_id,
                user_id,
            ),
        )

        record = (
            cursor.fetchone()
        )

        if not record:
            return {
                "checked_in":
                    False
            }

        return {
            "checked_in":
                True,

            "attendance_id":
                record[
                    "attendance_id"
                ],

            "check_in_time":
                record[
                    "check_in_time"
                ],

            "status":
                record[
                    "status"
                ],
        }

    finally:
        conn.close()


@router.get(
    "/attendance/override/{student_id}"
)
def get_attendance_override_details(
    student_id: int,
    course_id: int,
    current_user=Depends(
        require_instructor
    ),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT session_id
            FROM attendance_sessions
            WHERE course_id = ?
            ORDER BY session_id DESC
            LIMIT 1
            """,
            (course_id,),
        )

        session = (
            cursor.fetchone()
        )

        if not session:
            return {
                "success": False,
                "message":
                    "No attendance session found for this course.",
            }

        else:
            cursor.execute(
                """
                SELECT session_id
                FROM attendance_sessions
                ORDER BY session_id DESC
                LIMIT 1
                """
            )

            session = (
                cursor.fetchone()
            )

            if not session:
                return {
                    "success":
                        False,

                    "message":
                        "No attendance session found.",
                }

            session_id = session[
                "session_id"
            ]

        cursor.execute(
            """
            SELECT
                s.session_id,
                s.session_date,
                c.course_id,
                c.course_code,
                c.course_name,

                u.user_id AS user_id,
                u.student_id AS student_id,
                u.full_name AS student_name,

                ar.attendance_id,
                ar.check_in_time,
                ar.face_verified,
                ar.location_verified,

                CASE
                    WHEN ar.attendance_id IS NULL
                        THEN 'absent'
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
            (
                session_id,
                student_id,
            ),
        )

        record = (
            cursor.fetchone()
        )

        if not record:
            return {
                "success": False,
                "message":
                    "Student attendance record not found.",
            }

        attendance_id = record[
            "attendance_id"
        ]

        events = []

        if attendance_id is not None:
            cursor.execute(
                """
                SELECT
                    event_type,
                    event_time
                FROM geofence_status_changes
                WHERE attendance_id = ?
                ORDER BY event_time ASC
                """,
                (attendance_id,),
            )

            events = [
                {
                    "event_type":
                        row[
                            "event_type"
                        ],

                    "event_time":
                        row[
                            "event_time"
                        ],
                }
                for row in cursor.fetchall()
            ]

        return {
            "success": True,

            "student": {
                "user_id":
                    record[
                        "user_id"
                    ],

                "student_id":
                    record[
                        "student_id"
                    ],

                "student_name":
                    record[
                        "student_name"
                    ],
            },

            "course": {
                "course_id":
                    record[
                        "course_id"
                    ],

                "course_code":
                    record[
                        "course_code"
                    ],

                "course_name":
                    record[
                        "course_name"
                    ],
            },

            "session": {
                "session_id":
                    record[
                        "session_id"
                    ],

                "session_date":
                    record[
                        "session_date"
                    ],
            },

            "attendance": {
                "attendance_id":
                    attendance_id,

                "status":
                    record[
                        "status"
                    ],

                "check_in_time":
                    record[
                        "check_in_time"
                    ],

                "face_verified":
                    (
                        bool(
                            record[
                                "face_verified"
                            ]
                        )
                        if attendance_id
                        is not None
                        else False
                    ),

                "location_verified":
                    (
                        bool(
                            record[
                                "location_verified"
                            ]
                        )
                        if attendance_id
                        is not None
                        else False
                    ),
            },

            "events":
                events,
        }

    finally:
        conn.close()


@router.post(
    "/attendance/override"
)
def save_attendance_override(
    data: dict,
    current_user=Depends(
        require_instructor
    ),
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        session_id = data.get(
            "session_id"
        )

        student_id = data.get(
            "student_id"
        )

        status = (
            data.get(
                "status"
            )
            or ""
        ).lower()

        notes = (
            (
                data.get(
                    "notes"
                )
                or ""
            ).strip()
            or None
        )

        # --------------------------------------------------------
        # VALIDATE REQUEST
        # --------------------------------------------------------

        if (
            session_id is None
            or student_id is None
        ):
            return {
                "success": False,
                "message":
                    "Session and student are required.",
            }

        allowed_statuses = {
            "present",
            "late",
            "excused",
            "absent",
        }

        if (
            status
            not in allowed_statuses
        ):
            return {
                "success": False,
                "message":
                    "Invalid attendance status.",
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
            (
                session_id,
                student_id,
            ),
        )

        if not cursor.fetchone():
            return {
                "success": False,
                "message":
                    "Student is not enrolled in this session's course.",
            }

        cursor.execute(
            """
            SELECT attendance_id

            FROM attendance_records

            WHERE session_id = ?
              AND student_id = ?

            LIMIT 1
            """,
            (
                session_id,
                student_id,
            ),
        )

        existing = (
            cursor.fetchone()
        )

        if existing:
            cursor.execute(
                """
                UPDATE attendance_records

                SET
                    status = ?,
                    notes = ?

                WHERE attendance_id = ?
                """,
                (
                    status,
                    notes,
                    existing[
                        "attendance_id"
                    ],
                ),
            )

        elif status == "absent":
            # No attendance row is required for a naturally
            # absent student. /checkins already interprets
            # a missing row as absent.

            conn.commit()

            return {
                "success": True,
                "message":
                    "Attendance remains absent.",
                "status":
                    status,
            }

        else:
            override_time = (
                datetime.now(
                    CENTRAL_TZ
                ).strftime(
                    "%Y-%m-%d %H:%M:%S"
                )
            )

            cursor.execute(
                """
                INSERT INTO attendance_records (
                    session_id,
                    student_id,
                    check_in_time,
                    face_verified,
                    location_verified,
                    status,
                    notes
                )

                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    student_id,
                    override_time,
                    0,
                    0,
                    status,
                    notes,
                ),
            )

        conn.commit()

        return {
            "success": True,
            "message":
                "Attendance override saved.",
            "status":
                status,
        }

    except Exception as error:
        conn.rollback()

        return {
            "success": False,
            "message":
                str(error),
        }

    finally:
        conn.close()