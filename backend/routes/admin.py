import sqlite3
import json

from pydantic import BaseModel, EmailStr, Field
from typing import Literal
from fastapi import HTTPException
from fastapi import APIRouter, Depends

from backend.services.auth_service import hash_password
from backend.database.db import get_db_connection
from backend.services.token_service import require_admin

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
)

# ============================================================
# GET EXISTING USER
# ============================================================
@router.get("/users")
def get_users():
    conn = get_db_connection()

    try:
        cursor = conn.execute(
        """
        SELECT 
            user_id,
            full_name,
            email,
            role,
            student_id,
            created_at
        
        FROM users
        ORDER BY full_name
        """
    )

        return {
            "success": True,
            "users": [dict(row) for row in cursor.fetchall()]
        }

    finally:
        conn.close()

# ============================================================
# CREATE NEW USER
# ============================================================
class AdminCreateUser(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8)
    role: Literal["student", "instructor"]
    student_id: str | None = None


@router.post("/users", status_code=201)
def create_admin_user(data: AdminCreateUser):
    if data.role == "student" and not data.student_id:
        raise HTTPException(
            status_code=422,
            detail="Student ID is required for students",
        )

    conn = get_db_connection()

    try:
        cursor = conn.execute(
            """
            INSERT INTO users (
                full_name,
                email,
                password_hash,
                role,
                student_id
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                data.full_name.strip(),
                str(data.email).lower(),
                hash_password(data.password),
                data.role,
                data.student_id if data.role == "student" else None,
            ),
        )

        conn.commit()

        return {
            "success": True,
            "message": "User created successfully",
            "user_id": cursor.lastrowid,
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
# UPDATE EXISTING USER
# ============================================================

class AdminUpdateUser(BaseModel):
    full_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150
    )
    email: EmailStr | None = None
    student_id: str | None = None


@router.patch("/users/{user_id}")
def update_admin_user(
    user_id: int,
    data: AdminUpdateUser,
    current_admin=Depends(require_admin),
):
    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=422,
            detail="No changes provided"
        )

    # Normalize and validate incoming information.
    if "full_name" in updates:
        if updates["full_name"] is None:
            raise HTTPException(
                status_code=422,
                detail="Name cannot be empty"
            )

        updates["full_name"] = updates["full_name"].strip()

        if not updates["full_name"]:
            raise HTTPException(
                status_code=422,
                detail="Name cannot be empty"
            )

    if "email" in updates:
        if updates["email"] is None:
            raise HTTPException(
                status_code=422,
                detail="Email cannot be empty"
            )

        updates["email"] = str(updates["email"]).lower()

    if "student_id" in updates:
        updates["student_id"] = (
            updates["student_id"].strip()
            if updates["student_id"]
            else None
        )

    conn = get_db_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM users WHERE user_id = ?",
            (user_id,)
        )

        existing_user = cursor.fetchone()

        if not existing_user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        # Protect administrator accounts from changes
        # through this initial user-editing endpoint.
        if existing_user["role"] == "admin":
            raise HTTPException(
                status_code=403,
                detail="Admin accounts cannot be edited here"
            )

        if (
            "student_id" in updates
            and existing_user["role"] != "student"
            and updates["student_id"] is not None
        ):
            raise HTTPException(
                status_code=422,
                detail="Only students can have student IDs"
            )

        if (
            existing_user["role"] == "student"
            and "student_id" in updates
            and updates["student_id"] is None
        ):
            raise HTTPException(
                status_code=422,
                detail="Students must have a student ID"
            )

        # Only these approved database columns
        # may be modified.
        allowed_fields = (
            "full_name",
            "email",
            "student_id",
        )

        changes = {
            field: value
            for field, value in updates.items()
            if field in allowed_fields
            and existing_user[field] != value
        }

        if not changes:
            return {
                "success": True,
                "message": "No changes needed"
            }

        set_clause = ", ".join(
            f"{field} = ?"
            for field in changes
        )

        values = list(changes.values())
        values.append(user_id)

        cursor.execute(
            f"UPDATE users SET {set_clause} WHERE user_id = ?",
            values
        )

        # Log the administrative action.
        cursor.execute(
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
                current_admin["user_id"],
                "UPDATE_USER",
                user_id,
                json.dumps({
                    "changed_fields": list(changes.keys())
                })
            )
        )

        # Both operations succeed together.
        conn.commit()

        return {
            "success": True,
            "message": "User updated successfully",
            "user_id": user_id,
            "updated_fields": list(changes.keys())
        }

    except HTTPException:
        conn.rollback()
        raise

    except sqlite3.IntegrityError:
        conn.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email or student ID already exists"
        )

    finally:
        conn.close()
