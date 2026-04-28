from fastapi import APIRouter
from services.auth_service import login_user

router = APIRouter(prefix="/auth")  # ← add prefix here

@router.post("/login")             # ← this becomes /auth/login
def login(data: dict):
    user = login_user(data.get("email"), data.get("password"))

    if not user:
        return {"success": False, "message": "Invalid credentials"}

    return {
        "success": True,
        "user_id": user["user_id"],
        "name": user["full_name"],
        "role": user["role"],
        "face_enrolled": user["face_enrolled"],
        "token": str(user["user_id"])
    }