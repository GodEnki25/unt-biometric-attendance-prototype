from fastapi import APIRouter

from backend.services.auth_service import (
    login_user,
    create_user
)


router = APIRouter()


# ================================================================
# SIGNUP
# ================================================================

@router.post("/signup")
def signup(data: dict):

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")
    student_id = data.get("student_id")
    role = data.get("role", "student")


    # Make sure required fields were received
    if not full_name or not email or not password or not student_id:

        return {
            "success": False,
            "message": "Missing required signup information"
        }


    # Create user through authentication service
    result = create_user(
        full_name=full_name,
        email=email,
        password=password,
        role=role,
        student_id=student_id
    )


    # Account creation failed
    if not result["success"]:

        return result


    # IMPORTANT:
    # React needs this user_id so it can pass it to
    # firstTimeEnroll -> faceEnroll
    return {
        "success": True,
        "message": "Account created successfully",
        "user_id": result["user_id"]
    }


# ================================================================
# LOGIN
# ================================================================

@router.post("/login")
def login(data: dict):

    user = login_user(
        data.get("email"),
        data.get("password")
    )


    if not user:

        return {
            "success": False,
            "message": "Invalid credentials"
        }


    return {
        "success": True,

        "user": {
            "id": user["user_id"],
            "name": user["full_name"],
            "role": user["role"]
        }
    }
