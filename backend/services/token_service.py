import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.database.db import get_db_connection

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(
    Path(__file__).resolve().parents[2] / ".env"
)

JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
TOKEN_HOURS = 8

security = HTTPBearer()

def create_access_token(user_id: int, role: str):

    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured")

    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
        "iat": datetime.now(timezone.utc),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not JWT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET is not configured",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = int(payload["sub"])

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expired",
        )

    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    conn = get_db_connection()

    try:
        user = conn.execute(
            """
            SELECT
                user_id,
                role,
                is_active,
                is_root_admin
            FROM users
            WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()

        if not user or not user["is_active"]:
            raise HTTPException(
                status_code=401,
                detail="Account is inactive or no longer exists",
            )

        return {
            "user_id": user["user_id"],
            "role": user["role"],
            "is_root_admin": bool(user["is_root_admin"]),
        }

    finally:
        conn.close()

def require_instructor(
    current_user=Depends(get_current_user)):
    if current_user["role"] not in ("instructor", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Instructor access required",
        )

    return current_user


def require_admin(
    current_user=Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return current_user


def require_instructor(current_user=Depends(get_current_user)):

    if current_user["role"] not in ("instructor", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Instructor access required",
        )

    return current_user

def require_admin(current_user=Depends(get_current_user)):

    conn = get_db_connection()

    try:
        user = conn.execute(
            """
            SELECT role
            FROM users
            WHERE user_id = ?
            """,

            (current_user["user_id"],),
        ).fetchone()

        if not user or user["role"] != "admin":
            raise HTTPException(
                status_code=403,
                detail="Admin access required",
            )

        return {
            **current_user,
            "role": user["role"],
        }

    finally:
        conn.close()