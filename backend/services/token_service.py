import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

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
        credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM],)

        return {
            "user_id": int(payload["sub"]),
            "role": payload["role"],
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expired",
        )

def require_instructor(current_user=Depends(get_current_user)):

    if current_user["role"] not in ("instructor", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Instructor access required",
        )

    return current_user

def require_admin(current_user=Depends(get_current_user)):

    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return current_user