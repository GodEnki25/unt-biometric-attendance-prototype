from fastapi import APIRouter, UploadFile, File, Form

import cv2
import numpy as np

from biometrics.backend.enrollment.enrollment_layer import EnrollmentManager
from biometrics.backend.verification.verification_layer import Verifier
from backend.database.biometric_db import get_face_embedding

# ------------------------------------------------
# FASTAPI APPLICATION
# ------------------------------------------------

router = APIRouter()


# ------------------------------------------------
# ENROLLMENT MANAGER
# ------------------------------------------------

# Keeps enrollment embeddings between incoming frames
enrollment_manager = EnrollmentManager(
    required_captures=5
)


# ------------------------------------------------
# VERIFICATION SESSIONS
# ------------------------------------------------

# Stores a Verifier object for each user currently
# going through face verification.
#
# Example:
# {
#     15: Verifier(...),
#     22: Verifier(...)
# }
#
# This is important because Verifier.counter must
# survive between frames.
verification_sessions = {}


# ------------------------------------------------
# HELPER FUNCTION
# Convert uploaded React image into OpenCV frame
# ------------------------------------------------

async def get_frame(file: UploadFile):

    # Read uploaded image as raw bytes
    image_bytes = await file.read()

    # Make sure something was actually uploaded
    if not image_bytes:
        return None

    # Convert bytes into a NumPy array
    image_array = np.frombuffer(
        image_bytes,
        dtype=np.uint8
    )

    # Decode NumPy array into an OpenCV image
    frame = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    return frame


# ================================================================
# FACE ENROLLMENT
# ================================================================

@router.post("/enroll")
async def enroll_face(
    user_id: int = Form(...),
    file: UploadFile = File(...)
):

    # Convert incoming image into an OpenCV frame
    frame = await get_frame(file)

    # Image could not be decoded
    if frame is None:
        return {
            "status": "invalid_frame"
        }


    # Pass the user and frame into the enrollment manager
    #
    # EnrollmentManager handles:
    # detection
    # embedding collection
    # process_embeddings()
    # saving embedding into attendance.db
    result = enrollment_manager.process(
        user_id,
        frame
    )

    # Send enrollment status back to React
    return result


# ================================================================
# FACE VERIFICATION
# ================================================================

@router.post("/verify")
async def verify_face(
    user_id: int = Form(...),
    file: UploadFile = File(...)
):

    # Convert incoming image into OpenCV frame
    frame = await get_frame(file)

    if frame is None:
        return {
            "status": "invalid_frame"
        }


    # ------------------------------------------------
    # CREATE VERIFICATION SESSION
    # ------------------------------------------------

    # Only create a new Verifier when the user begins
    # verification for the first time.
    if user_id not in verification_sessions:

        # Get this user's saved face embedding
        # from attendance.db -> face_profiles
        stored_embedding = get_face_embedding(user_id)

        # User has an account but has never completed
        # biometric enrollment
        if stored_embedding is None:
            return {
                "status": "face_not_enrolled"
            }


        # ------------------------------------------------
        # Your existing Verifier expects a DATABASE.
        #
        # Since we already know which logged-in user
        # is being verified, create a database containing
        # only that user.
        # ------------------------------------------------

        user_database = {
            str(user_id): stored_embedding
        }


        # Create Verifier and keep it alive between frames
        verification_sessions[user_id] = Verifier(
            user_database
        )


    # ------------------------------------------------
    # PROCESS CURRENT FRAME
    # ------------------------------------------------

    verifier = verification_sessions[user_id]

    # Verifier handles:
    #
    # detect_faces(frame)
    #        ↓
    # normed_embedding
    #        ↓
    # run_liveness_check(frame)
    #        ↓
    # recognize_face()
    #        ↓
    # consecutive match counter
    result = verifier.process(frame)


    # ------------------------------------------------
    # VERIFICATION COMPLETED
    # ------------------------------------------------

    if result["status"] == "verified":

        # Verification is finished.
        # Delete temporary session so the next
        # verification starts fresh.
        del verification_sessions[user_id]


    # Send result back to React Native
    return result