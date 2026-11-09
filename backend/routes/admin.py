import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import Literal

from backend.database.db import get_db_connection
from backend.services.auth_service import hash_password
from backend.services.token_service import require_admin


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
)


# ============================================================
# REQUEST MODELS
# ============================================================

Role = Literal["student", "instructor", "admin"]


class AdminCreateUser(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role
    student_id: str | None = None


class AdminUpdateUser(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    email: EmailStr | None = None
    student_id: str | None = None
    role: Role | None = None
    is_active: bool | None = None


class AdminCreateCourse(BaseModel):
    course_code: str = Field(min_length=1, max_length=40)
    course_name: str = Field(min_length=1, max_length=150)


class AdminUpdateCourse(BaseModel):
    course_code: str | None = Field(default=None, min_length=1, max_length=40)
    course_name: str | None = Field(default=None, min_length=1, max_length=150)
    is_active: bool | None = None


class InstructorAssignment(BaseModel):
    instructor_id: int | None = None


class StudentEnrollment(BaseModel):
    student_id: int


# ============================================================
# HELPERS
# ============================================================

def find_user(conn, user_id):
    return conn.execute(
        "SELECT * FROM users WHERE user_id = ?",
        (user_id,),
    ).fetchone()


def find_course(conn, course_id):
    return conn.execute(
        "SELECT * FROM courses WHERE course_id = ?",
        (course_id,),
    ).fetchone()


def log_action(conn, admin_id, action, target_user_id=None, details=None):
    conn.execute(
        """
        INSERT INTO admin_audit_logs (
            admin_id,
            action,
            target_user_id,
            details
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            admin_id,
            action,
            target_user_id,
            json.dumps(details or {}),
        ),
    )


def required_text(value, label):
    if value is None or not value.strip():
        raise HTTPException(
            status_code=422,
            detail=f"{label} cannot be empty",
        )
    return value.strip()


def validate_student_id(role, student_id):
    if role == "student":
        if not student_id or not student_id.strip():
            raise HTTPException(
                status_code=422,
                detail="Student ID is required for students",
            )
        return student_id.strip()

    return None


def has_open_session(conn, course_id):
    return conn.execute(
        """
        SELECT 1
        FROM attendance_sessions
        WHERE course_id = ?
          AND end_time IS NULL
        LIMIT 1
        """,
        (course_id,),
    ).fetchone() is not None


# ============================================================
# USER MANAGEMENT - LIST
# ============================================================

@router.get("/users")
def get_users():
    conn = get_db_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                user_id,
                full_name,
                email,
                role,
                student_id,
                created_at,
                is_active,
                is_root_admin
            FROM users
            ORDER BY is_active DESC, full_name
            """
        ).fetchall()

        return {
            "success": True,
            "users": [dict(row) for row in rows],
        }

    finally:
        conn.close()


# ============================================================
# USER MANAGEMENT - CREATE
# ============================================================

@router.post("/users", status_code=201)
def create_admin_user(
    data: AdminCreateUser,
    admin=Depends(require_admin),
):
    if data.role == "admin" and not admin["is_root_admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only root administrator can create admins",
        )

    name = required_text(data.full_name, "Full name")
    email = str(data.email).lower()
    student_id = validate_student_id(data.role, data.student_id)

    conn = get_db_connection()

    try:
        cursor = conn.execute(
            """
            INSERT INTO users (
                full_name,
                email,
                password_hash,
                role,
                student_id,
                is_active,
                is_root_admin
            )
            VALUES (?, ?, ?, ?, ?, 1, 0)
            """,
            (
                name,
                email,
                hash_password(data.password),
                data.role,
                student_id,
            ),
        )

        user_id = cursor.lastrowid

        log_action(
            conn,
            admin["user_id"],
            "CREATE_USER",
            user_id,
            {"role": data.role},
        )

        conn.commit()

        return {
            "success": True,
            "message": "User created successfully",
            "user_id": user_id,
        }

    except sqlite3.IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email or student ID already exists",
        )

    finally:
        conn.close()


# ============================================================
# USER MANAGEMENT - EDIT / ROLES / RESTORE
# ============================================================

@router.patch("/users/{user_id}")
def update_admin_user(
    user_id: int,
    data: AdminUpdateUser,
    admin=Depends(require_admin),
):
    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=422,
            detail="No changes provided",
        )

    conn = get_db_connection()

    try:
        existing = find_user(conn, user_id)

        if not existing:
            raise HTTPException(404, "User not found")

        if existing["is_root_admin"]:
            raise HTTPException(
                403,
                "Root administrator cannot be modified",
            )

        new_role = updates.get("role", existing["role"])

        if(
            existing["role"] == "admin"
            and not admin["is_root_admin"]
        ):
            raise HTTPException(
                status_code=403,
                detail="Only root can modify administartors",
            )

        if (
            new_role == "admin"
            and existing["role"] != "admin"
            and not admin["is_root_admin"]
        ):
            raise HTTPException(
                status_code=403,
                detail="Only root can grant administrator privileges",
            )

        if (
            user_id == admin["user_id"]
            and (
                updates.get("role", existing["role"]) != "admin"
                or updates.get("is_active") is False
            )
        ):
            raise HTTPException(
                403,
                "You cannot revoke your own admin access",
            )

        new_role = updates.get("role", existing["role"])

        if new_role is None:
            raise HTTPException(422, "Role cannot be empty")

        if "full_name" in updates:
            updates["full_name"] = required_text(
                updates["full_name"], "Full name"
            )

        if "email" in updates:
            if updates["email"] is None:
                raise HTTPException(422, "Email cannot be empty")
            updates["email"] = str(updates["email"]).lower()

        student_id = updates.get(
            "student_id", existing["student_id"]
        )

        updates["student_id"] = validate_student_id(
            new_role, student_id
        )

        if "is_active" in updates and updates["is_active"] is None:
            raise HTTPException(422, "Account status cannot be null")

        # Prevent dangling relationships when changing roles.
        if existing["role"] == "instructor" and new_role != "instructor":
            assigned = conn.execute(
                """
                SELECT 1 FROM courses
                WHERE instructor_id = ?
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()

            if assigned:
                raise HTTPException(
                    409,
                    "Reassign this instructor's courses first",
                )

        if existing["role"] == "student" and new_role != "student":
            enrolled = conn.execute(
                """
                SELECT 1 FROM course_enrollments
                WHERE student_id = ?
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()

            if enrolled:
                raise HTTPException(
                    409,
                    "Remove this student's course enrollments first",
                )

        changes = {
            field: value
            for field, value in updates.items()
            if existing[field] != value
        }

        if not changes:
            return {
                "success": True,
                "message": "No changes needed",
            }

        set_clause = ", ".join(
            f"{field} = ?" for field in changes
        )

        conn.execute(
            f"UPDATE users SET {set_clause} WHERE user_id = ?",
            [*changes.values(), user_id],
        )

        log_action(
            conn,
            admin["user_id"],
            "UPDATE_USER",
            user_id,
            {
                "changed_fields": list(changes.keys()),
                "old_role": existing["role"],
                "new_role": new_role,
            },
        )

        conn.commit()

        return {
            "success": True,
            "message": "User updated successfully",
            "user_id": user_id,
            "updated_fields": list(changes.keys()),
        }

    except HTTPException:
        conn.rollback()
        raise

    except sqlite3.IntegrityError:
        conn.rollback()
        raise HTTPException(
            409,
            "Email or student ID already exists",
        )

    finally:
        conn.close()


# ============================================================
# USER MANAGEMENT - REMOVE / DEACTIVATE
# ============================================================

@router.delete("/users/{user_id}")
def remove_admin_user(
    user_id: int,
    admin=Depends(require_admin),
):
    conn = get_db_connection()

    try:
        user = find_user(conn, user_id)

        if not user:
            raise HTTPException(404, "User not found")

        if user["is_root_admin"]:
            raise HTTPException(403, "Root admin is protected")

        if (
            user["role"] == "admin"
            and not admin["is_root_admin"]
        ):
            raise HTTPException(
                status_code=403,
                detail="Only root can remove administrators",
            )

        if user_id == admin["user_id"]:
            raise HTTPException(
                403,
                "You cannot remove your own account",
            )

        if not user["is_active"]:
            return {
                "success": True,
                "message": "Account is already inactive",
            }

        if user["role"] == "instructor":
            assigned = conn.execute(
                """
                SELECT 1 FROM courses
                WHERE instructor_id = ?
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()

            if assigned:
                raise HTTPException(
                    409,
                    "Reassign this instructor's courses first",
                )

        conn.execute(
            """
            UPDATE users
            SET is_active = 0
            WHERE user_id = ?
            """,
            (user_id,),
        )

        log_action(
            conn,
            admin["user_id"],
            "DEACTIVATE_USER",
            user_id,
            {"role": user["role"]},
        )

        conn.commit()

        return {
            "success": True,
            "message": "User deactivated successfully",
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        conn.close()


# ============================================================
# COURSE MANAGEMENT - LIST
# ============================================================

@router.get("/courses")
def get_admin_courses():
    conn = get_db_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                c.course_id,
                c.course_code,
                c.course_name,
                c.instructor_id,
                c.is_active,
                u.full_name AS instructor_name,
                (
                    SELECT COUNT(*)
                    FROM course_enrollments ce
                    JOIN users student
                      ON student.user_id = ce.student_id
                    WHERE ce.course_id = c.course_id
                      AND student.is_active = 1
                ) AS student_count
            FROM courses c
            LEFT JOIN users u
              ON u.user_id = c.instructor_id
            ORDER BY c.is_active DESC, c.course_code
            """
        ).fetchall()

        return {
            "success": True,
            "courses": [dict(row) for row in rows],
        }

    finally:
        conn.close()


# ============================================================
# COURSE MANAGEMENT - CREATE
# ============================================================

@router.post("/courses", status_code=201)
def create_admin_course(
    data: AdminCreateCourse,
    admin=Depends(require_admin),
):
    code = required_text(data.course_code, "Course code").upper()
    name = required_text(data.course_name, "Course name")

    conn = get_db_connection()

    try:
        duplicate = conn.execute(
            """
            SELECT 1 FROM courses
            WHERE LOWER(course_code) = LOWER(?)
            LIMIT 1
            """,
            (code,),
        ).fetchone()

        if duplicate:
            raise HTTPException(409, "Course code already exists")

        cursor = conn.execute(
            """
            INSERT INTO courses (
                course_code, course_name, is_active
            )
            VALUES (?, ?, 1)
            """,
            (code, name),
        )

        course_id = cursor.lastrowid

        log_action(
            conn,
            admin["user_id"],
            "CREATE_COURSE",
            details={"course_id": course_id, "course_code": code},
        )

        conn.commit()

        return {
            "success": True,
            "course_id": course_id,
            "message": "Course created successfully",
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        conn.close()


# ============================================================
# COURSE MANAGEMENT - EDIT / RESTORE
# ============================================================

@router.patch("/courses/{course_id}")
def update_admin_course(
    course_id: int,
    data: AdminUpdateCourse,
    admin=Depends(require_admin),
):
    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(422, "No changes provided")

    conn = get_db_connection()

    try:
        course = find_course(conn, course_id)

        if not course:
            raise HTTPException(404, "Course not found")

        if "course_code" in updates:
            updates["course_code"] = required_text(
                updates["course_code"], "Course code"
            ).upper()

            duplicate = conn.execute(
                """
                SELECT 1 FROM courses
                WHERE LOWER(course_code) = LOWER(?)
                  AND course_id != ?
                """,
                (updates["course_code"], course_id),
            ).fetchone()

            if duplicate:
                raise HTTPException(409, "Course code already exists")

        if "course_name" in updates:
            updates["course_name"] = required_text(
                updates["course_name"], "Course name"
            )

        if "is_active" in updates and updates["is_active"] is None:
            raise HTTPException(422, "Course status cannot be null")

        changes = {
            field: value
            for field, value in updates.items()
            if course[field] != value
        }

        if not changes:
            return {"success": True, "message": "No changes needed"}

        if changes.get("is_active") is False:
            if has_open_session(conn, course_id):
                raise HTTPException(
                    409, "Close the course's session before archiving"
                )

        set_clause = ", ".join(
            f"{field} = ?" for field in changes
        )

        conn.execute(
            f"UPDATE courses SET {set_clause} WHERE course_id = ?",
            [*changes.values(), course_id],
        )

        log_action(
            conn,
            admin["user_id"],
            "UPDATE_COURSE",
            details={
                "course_id": course_id,
                "changed_fields": list(changes.keys()),
            },
        )

        conn.commit()

        return {
            "success": True,
            "message": "Course updated successfully",
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        conn.close()


# ============================================================
# COURSE MANAGEMENT - ARCHIVE
# ============================================================

@router.delete("/courses/{course_id}")
def remove_admin_course(
    course_id: int,
    admin=Depends(require_admin),
):
    conn = get_db_connection()

    try:
        course = find_course(conn, course_id)

        if not course:
            raise HTTPException(404, "Course not found")

        if has_open_session(conn, course_id):
            raise HTTPException(
                409, "Close the attendance session first"
            )

        if not course["is_active"]:
            return {
                "success": True,
                "message": "Course already archived",
            }

        conn.execute(
            "UPDATE courses SET is_active = 0 WHERE course_id = ?",
            (course_id,),
        )

        log_action(
            conn,
            admin["user_id"],
            "ARCHIVE_COURSE",
            details={"course_id": course_id},
        )

        conn.commit()

        return {
            "success": True,
            "message": "Course archived successfully",
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        conn.close()


# ============================================================
# COURSE MANAGEMENT - ASSIGN INSTRUCTOR
# ============================================================

@router.put("/courses/{course_id}/instructor")
def assign_course_instructor(
    course_id: int,
    data: InstructorAssignment,
    admin=Depends(require_admin),
):
    conn = get_db_connection()

    try:
        course = find_course(conn, course_id)

        if not course or not course["is_active"]:
            raise HTTPException(404, "Active course not found")

        if has_open_session(conn, course_id):
            raise HTTPException(
                409, "Cannot reassign during an open session"
            )

        if data.instructor_id is not None:
            user = find_user(conn, data.instructor_id)

            if (
                not user
                or not user["is_active"]
                or user["role"] != "instructor"
            ):
                raise HTTPException(
                    422, "Select an active instructor"
                )

        conn.execute(
            """
            UPDATE courses
            SET instructor_id = ?
            WHERE course_id = ?
            """,
            (data.instructor_id, course_id),
        )

        log_action(
            conn,
            admin["user_id"],
            "ASSIGN_INSTRUCTOR",
            details={
                "course_id": course_id,
                "instructor_id": data.instructor_id,
            },
        )

        conn.commit()

        return {
            "success": True,
            "message": "Instructor assignment updated",
        }

    finally:
        conn.close()


# ============================================================
# COURSE MANAGEMENT - VIEW STUDENTS
# ============================================================

@router.get("/courses/{course_id}/students")
def get_course_students(course_id: int):
    conn = get_db_connection()

    try:
        if not find_course(conn, course_id):
            raise HTTPException(404, "Course not found")

        rows = conn.execute(
            """
            SELECT
                u.user_id,
                u.full_name,
                u.email,
                u.student_id,
                u.is_active
            FROM course_enrollments ce
            JOIN users u
              ON u.user_id = ce.student_id
            WHERE ce.course_id = ?
            ORDER BY u.full_name
            """,
            (course_id,),
        ).fetchall()

        return {
            "success": True,
            "students": [dict(row) for row in rows],
        }

    finally:
        conn.close()


# ============================================================
# COURSE MANAGEMENT - ENROLL STUDENT
# ============================================================

@router.post("/courses/{course_id}/enrollments", status_code=201)
def enroll_student(
    course_id: int,
    data: StudentEnrollment,
    admin=Depends(require_admin),
):
    conn = get_db_connection()

    try:
        course = find_course(conn, course_id)
        student = find_user(conn, data.student_id)

        if not course or not course["is_active"]:
            raise HTTPException(404, "Active course not found")

        if (
            not student
            or student["role"] != "student"
            or not student["is_active"]
        ):
            raise HTTPException(422, "Select an active student")

        existing = conn.execute(
            """
            SELECT 1 FROM course_enrollments
            WHERE course_id = ? AND student_id = ?
            """,
            (course_id, data.student_id),
        ).fetchone()

        if existing:
            raise HTTPException(409, "Student already enrolled")

        conn.execute(
            """
            INSERT INTO course_enrollments (course_id, student_id)
            VALUES (?, ?)
            """,
            (course_id, data.student_id),
        )

        log_action(
            conn,
            admin["user_id"],
            "ENROLL_STUDENT",
            data.student_id,
            {"course_id": course_id},
        )

        conn.commit()

        return {
            "success": True,
            "message": "Student enrolled successfully",
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        conn.close()


# ============================================================
# COURSE MANAGEMENT - REMOVE ENROLLMENT
# ============================================================

@router.delete("/courses/{course_id}/enrollments/{student_id}")
def unenroll_student(
    course_id: int,
    student_id: int,
    admin=Depends(require_admin),
):
    conn = get_db_connection()

    try:
        if not find_course(conn, course_id):
            raise HTTPException(404, "Course not found")

        cursor = conn.execute(
            """
            DELETE FROM course_enrollments
            WHERE course_id = ? AND student_id = ?
            """,
            (course_id, student_id),
        )

        if cursor.rowcount == 0:
            raise HTTPException(404, "Enrollment not found")

        log_action(
            conn,
            admin["user_id"],
            "UNENROLL_STUDENT",
            student_id,
            {"course_id": course_id},
        )

        conn.commit()

        return {
            "success": True,
            "message": "Student removed from course",
        }

    except HTTPException:
        conn.rollback()
        raise

    finally:
        conn.close()

# ============================================================
# CURRENT ADMIN PERMISSIONS
# ============================================================

@router.get("/me")
def get_admin_profile(admin=Depends(require_admin)):
    return {
        "user_id": admin["user_id"],
        "role": admin["role"],
        "is_root_admin": admin["is_root_admin"],
    }