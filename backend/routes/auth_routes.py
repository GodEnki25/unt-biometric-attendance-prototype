from fastapi import APIRouter

from backend.services.auth_service import (
    login_user,
    create_user
)

from backend.services.token_service import create_access_token


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
    role = "student"


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

    token = create_access_token(
        user_id=result["user_id"],
        role="student"
    )

    return {
        "success": True,
        "message": "Account created successfully",
        "user_id": result["user_id"],
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": result["user_id"],
            "name": full_name,
            "role": "student"
        }
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

    token = create_access_token(
        user_id=user["user_id"],
        role=user["role"]
    )

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",

        "user": {
            "id": user["user_id"],
            "name": user["full_name"],
            "role": user["role"]
        }
    }
