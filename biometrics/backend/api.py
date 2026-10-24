
from threading import RLock
from time import monotonic

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, UploadFile

from backend.database.biometric_db import (
    get_face_embedding,
    get_periocular_embedding
)
from backend.services.token_service import get_current_user
from biometrics.backend.enrollment.enrollment_layer import EnrollmentManager
from biometrics.backend.verification.verification_layer import Verifier


router = APIRouter()

enrollment_manager = EnrollmentManager(required_captures=7)

verification_sessions = {}
verified_users = set()

MAX_IMAGE_BYTES = 3 * 1024 * 1024
MAX_SESSION_SECONDS = 120

MIN_BRIGHTNESS = 40
MAX_BRIGHTNESS = 215
MIN_SHARPNESS = 30.0

_enrollment_lock = RLock()
_enrollment_started = {}

_verification_lock = RLock()


async def get_frame(file: UploadFile):
    try:
        image_bytes = await file.read(MAX_IMAGE_BYTES + 1)

        if (
            not image_bytes
            or len(image_bytes) > MAX_IMAGE_BYTES
        ):
            return None

        return cv2.imdecode(
            np.frombuffer(image_bytes, dtype=np.uint8),
            cv2.IMREAD_COLOR
        )

    finally:
        await file.close()


def frame_quality_ok(frame):
    if frame is None or frame.size == 0:
        return False

    height, width = frame.shape[:2]

    if height < 240 or width < 240:
        return False

    center = frame[
        height // 5:height * 4 // 5,
        width // 5:width * 4 // 5
    ]

    if center.size == 0:
        return False

    gray = cv2.cvtColor(
        center,
        cv2.COLOR_BGR2GRAY
    )

    gray = cv2.resize(
        gray,
        (320, 320),
        interpolation=cv2.INTER_AREA
    )

    brightness = float(np.mean(gray))

    if not MIN_BRIGHTNESS <= brightness <= MAX_BRIGHTNESS:
        return False

    sharpness = float(
        cv2.Laplacian(
            gray,
            cv2.CV_64F
        ).var()
    )

    return sharpness >= MIN_SHARPNESS


def clear_enrollment(user_id):
    enrollment_manager.sessions.pop(user_id, None)
    _enrollment_started.pop(user_id, None)


def clear_verification(user_id):
    verifier = verification_sessions.pop(
        user_id,
        None
    )

    if verifier is not None:
        verifier.close()


@router.get("/biometric-test")
def biometric_test():
    return {
        "status": "working",
        "version": "DUAL_BIOMETRIC_LIVENESS_V1"
    }


@router.post("/enroll/start")
def start_frame_enrollment(
    current_user=Depends(get_current_user)
):
    user_id = current_user["user_id"]

    with _enrollment_lock:
        clear_enrollment(user_id)

        enrollment_manager.sessions[user_id] = []
        _enrollment_started[user_id] = monotonic()

    return {
        "status": "ready",
        "captures": 0,
        "required": enrollment_manager.required_captures
    }


@router.post("/enroll/frame")
def enroll_frame(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    user_id = current_user["user_id"]
    required = enrollment_manager.required_captures

    try:
        data = file.file.read(MAX_IMAGE_BYTES + 1)

        if not data or len(data) > MAX_IMAGE_BYTES:
            return {
                "status": "invalid_frame",
                "message": "Frame is empty or exceeds 3 MB."
            }

        frame = cv2.imdecode(
            np.frombuffer(data, dtype=np.uint8),
            cv2.IMREAD_COLOR
        )

        if frame is None:
            return {
                "status": "invalid_frame",
                "message": "Cannot decode image."
            }

        with _enrollment_lock:
            started = _enrollment_started.get(user_id)

            if started is None:
                return {
                    "status": "session_not_started",
                    "message": (
                        "Start enrollment before sending frames."
                    )
                }

            if monotonic() - started > MAX_SESSION_SECONDS:
                clear_enrollment(user_id)

                return {
                    "status": "session_expired",
                    "message": (
                        "Enrollment expired. Please restart the scan."
                    )
                }

            if not frame_quality_ok(frame):
                return {
                    "status": "low_quality",
                    "captures": len(
                        enrollment_manager.sessions.get(
                            user_id, []
                        )
                    ),
                    "required": required,
                    "message": (
                        "Improve lighting or hold the camera steady."
                    )
                }

            try:
                result = enrollment_manager.process(
                    user_id,
                    frame
                )

            except Exception:
                clear_enrollment(user_id)
                raise

            if result.get("status") == "enrolled":
                clear_enrollment(user_id)

            return result

    except Exception:
        print(
            "Enrollment frame processing failed for user:",
            user_id
        )

        return {
            "status": "enrollment_error",
            "message": "Unable to process enrollment frame."
        }

    finally:
        file.file.close()


@router.post("/enroll/cancel")
def cancel_frame_enrollment(
    current_user=Depends(get_current_user)
):
    user_id = current_user["user_id"]

    with _enrollment_lock:
        clear_enrollment(user_id)

    return {
        "status": "cancelled"
    }


@router.post("/verify")
async def verify_face(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    user_id = current_user["user_id"]

    frame = await get_frame(file)

    if frame is None:
        return {
            "status": "invalid_frame"
        }

    with _verification_lock:

        if user_id not in verification_sessions:

            stored_embedding = get_face_embedding(
                user_id
            )

            if stored_embedding is None:
                return {
                    "status": "face_not_enrolled"
                }

            stored_periocular = get_periocular_embedding(
                user_id
            )

            verification_sessions[user_id] = Verifier(
                stored_embedding=stored_embedding,
                stored_periocular_embedding=stored_periocular
            )

        verifier = verification_sessions[user_id]

        try:
            result = verifier.process(frame)

        except Exception:
            clear_verification(user_id)
            raise

        if result["status"] == "verified":
            verified_users.add(user_id)
            clear_verification(user_id)

        elif result["status"] == "liveness_failed":
            clear_verification(user_id)

        return result


@router.post("/verify/cancel")
def cancel_verification(
    current_user=Depends(get_current_user)
):
    user_id = current_user["user_id"]

    with _verification_lock:
        clear_verification(user_id)

    return {
        "status": "cancelled"
    }
