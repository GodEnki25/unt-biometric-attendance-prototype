from fastapi import APIRouter
from backend.services.auth_service import login_user

router = APIRouter()


@router.post("/login")
def login(data: dict):
    user = login_user(data.get("email"), data.get("password"))

    if not user:
        return {"success": False, "message": "Invalid credentials"}

    return {
        "success": True,
        "user": {
            "id": user["user_id"],
            "name": user["full_name"],
            "role": user["role"]
        }
    }
