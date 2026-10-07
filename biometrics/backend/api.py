from fastapi import APIRouter, UploadFile, File, Depends

import cv2
import os
import tempfile
import numpy as np

from biometrics.backend.enrollment.enrollment_layer import EnrollmentManager
from biometrics.backend.verification.verification_layer import Verifier
from backend.database.biometric_db import get_face_embedding
from backend.services.token_service import get_current_user


# ------------------------------------------------
# FASTAPI ROUTER
# ------------------------------------------------

router = APIRouter()


# ------------------------------------------------
# ENROLLMENT MANAGER
# ------------------------------------------------

# Enrollment completes after 7 valid face captures.
enrollment_manager = EnrollmentManager(
    required_captures=7
)


# ------------------------------------------------
# VERIFICATION SESSIONS
# ------------------------------------------------

# Stores a Verifier object for each user currently
# going through face verification.
verification_sessions = {}


# Stores users who successfully completed
# biometric verification.
verified_users = set()


# ------------------------------------------------
# HELPER FUNCTION
# Convert uploaded React image into OpenCV frame
#
# This is still used by /verify.
# /enroll now receives a video instead.
# ------------------------------------------------

async def get_frame(file: UploadFile):

    image_bytes = await file.read()

    if not image_bytes:
        return None

    image_array = np.frombuffer(
        image_bytes,
        dtype=np.uint8
    )

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
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):

    print("\n>>> NEW VIDEO ENROLL ENDPOINT CALLED <<<")

    user_id = current_user["user_id"]

    print(f"Enrollment user: {user_id}")
    print(f"Uploaded filename: {file.filename}")
    print(f"Uploaded content type: {file.content_type}")

    temp_path = None
    video = None

    try:

        # ------------------------------------------------
        # READ VIDEO
        # ------------------------------------------------

        video_data = await file.read()

        if not video_data:

            enrollment_manager.sessions.pop(
                user_id,
                None
            )

            return {
                "status": "invalid_video",
                "message": "No video data received."
            }

        print(
            f"Received video bytes: {len(video_data)}"
        )


        # ------------------------------------------------
        # CREATE TEMPORARY VIDEO FILE
        # ------------------------------------------------

        # iPhone / Expo currently records the enrollment
        # video as .mov.
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".mov"
        ) as temp_file:

            temp_file.write(video_data)

            temp_path = temp_file.name


        print(
            f"Temporary video: {temp_path}"
        )


        # ------------------------------------------------
        # OPEN VIDEO WITH OPENCV
        # ------------------------------------------------

        video = cv2.VideoCapture(
            temp_path
        )


        if not video.isOpened():

            enrollment_manager.sessions.pop(
                user_id,
                None
            )

            return {
                "status": "invalid_video",
                "message": "Unable to open enrollment video."
            }


        # ------------------------------------------------
        # VIDEO INFORMATION
        # ------------------------------------------------

        total_frames = int(
            video.get(
                cv2.CAP_PROP_FRAME_COUNT
            )
        )

        fps = video.get(
            cv2.CAP_PROP_FPS
        )


        print(
            f"Enrollment video frames: {total_frames}"
        )

        print(
            f"Enrollment video FPS: {fps}"
        )


        if total_frames <= 0:

            enrollment_manager.sessions.pop(
                user_id,
                None
            )

            return {
                "status": "invalid_video",
                "message": "Video contains no readable frames."
            }


        # ------------------------------------------------
        # FRAME SAMPLING
        # ------------------------------------------------

        # We want roughly 20 opportunities to find
        # 7 good face embeddings.
        #
        # Example:
        #
        # 60 frames / 20 = every 3rd frame
        #
        # We stop immediately once 7 valid embeddings
        # have been collected.

        frame_step = max(
            total_frames // 20,
            1
        )


        print(
            f"Processing every {frame_step} frame(s)"
        )


        frame_number = 0

        last_good_result = None

        processed_frames = 0


        # ------------------------------------------------
        # PROCESS VIDEO
        # ------------------------------------------------

        while True:

            success, frame = video.read()


            # End of video
            if not success:
                break


            # --------------------------------------------
            # SKIP FRAMES BETWEEN SAMPLES
            # --------------------------------------------

            if frame_number % frame_step != 0:

                frame_number += 1

                continue


            processed_frames += 1


            print(
                f"\nProcessing enrollment frame: "
                f"{frame_number}"
            )


            # --------------------------------------------
            # SEND FRAME TO ENROLLMENT MANAGER
            # --------------------------------------------

            result = enrollment_manager.process(
                user_id,
                frame
            )


            print(
                "Enrollment result:",
                result
            )


            status = result.get(
                "status"
            )


            # --------------------------------------------
            # VALID FACE + EMBEDDING COLLECTED
            # --------------------------------------------

            if status == "collecting":

                last_good_result = result

                captures = result.get(
                    "captures",
                    0
                )

                print(
                    f"VALID FACE: "
                    f"{captures} / 7"
                )


            # --------------------------------------------
            # ENROLLMENT FINISHED
            # --------------------------------------------

            elif status == "enrolled":

                print(
                    "\n=============================="
                )

                print(
                    "FACE ENROLLMENT COMPLETE"
                )

                print(
                    "==============================\n"
                )

                return result


            # --------------------------------------------
            # BAD FRAME
            #
            # Do NOT fail enrollment because one frame
            # was bad. Continue searching the video.
            # --------------------------------------------

            else:

                print(
                    f"Skipping frame "
                    f"{frame_number}: "
                    f"{status}"
                )


            frame_number += 1


        # ------------------------------------------------
        # VIDEO FINISHED
        # ------------------------------------------------

        print(
            f"\nProcessed sampled frames: "
            f"{processed_frames}"
        )


        # Find how many valid embeddings were collected.
        captures = 0

        if last_good_result is not None:

            captures = last_good_result.get(
                "captures",
                0
            )


        print(
            f"Valid enrollment captures: "
            f"{captures} / 7"
        )


        # IMPORTANT:
        # If enrollment failed, remove the incomplete
        # session so the next scan starts from 0/7.
        enrollment_manager.sessions.pop(
            user_id,
            None
        )


        # ------------------------------------------------
        # NOT ENOUGH GOOD EMBEDDINGS
        # ------------------------------------------------

        if captures > 0:

            return {
                "status": "insufficient_embeddings",
                "captures": captures,
                "required": 7,
                "message":
                    f"Only {captures} of 7 valid face samples "
                    f"were detected. Please try again."
            }


        # ------------------------------------------------
        # NO VALID FACE FOUND
        # ------------------------------------------------

        return {
            "status": "no_valid_face",
            "captures": 0,
            "required": 7,
            "message":
                "No valid face was detected. "
                "Keep one face centered in the camera "
                "and try again."
        }


    # ------------------------------------------------
    # UNEXPECTED ERROR
    # ------------------------------------------------

    except Exception as error:

        print(
            "\nENROLLMENT VIDEO ERROR:"
        )

        print(
            repr(error)
        )


        # Clear incomplete enrollment.
        enrollment_manager.sessions.pop(
            user_id,
            None
        )


        return {
            "status": "enrollment_error",
            "message":
                f"Unable to process enrollment video: "
                f"{str(error)}"
        }


    # ------------------------------------------------
    # CLEANUP
    # ------------------------------------------------

    finally:

        # Release OpenCV video.
        if video is not None:

            try:
                video.release()

            except Exception:
                pass


        # Delete temporary video.
        if (
            temp_path
            and os.path.exists(temp_path)
        ):

            try:

                os.remove(
                    temp_path
                )

                print(
                    "Temporary enrollment video deleted."
                )

            except Exception as error:

                print(
                    "Temporary video cleanup error:",
                    error
                )


# ================================================================
# FACE VERIFICATION
# ================================================================

@router.post("/verify")
async def verify_face(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):

    user_id = current_user["user_id"]


    # ------------------------------------------------
    # CONVERT UPLOADED IMAGE TO OPENCV FRAME
    # ------------------------------------------------

    frame = await get_frame(
        file
    )


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

        # Get saved face embedding.
        stored_embedding = get_face_embedding(
            user_id
        )


        # User has not completed enrollment.
        if stored_embedding is None:

            return {
                "status": "face_not_enrolled"
            }


        # Create verifier for this user.
        verification_sessions[user_id] = Verifier(
            stored_embedding
        )


    # ------------------------------------------------
    # PROCESS CURRENT FRAME
    # ------------------------------------------------

    verifier = verification_sessions[
        user_id
    ]


    # Verifier handles:
    #
    # detect_faces(frame)
    #       ↓
    # normed_embedding
    #       ↓
    # liveness
    #       ↓
    # recognition
    #       ↓
    # consecutive match counter

    result = verifier.process(
        frame
    )


    # ------------------------------------------------
    # VERIFICATION COMPLETED
    # ------------------------------------------------

    if result["status"] == "verified":

        # Mark user as biometrically verified.
        verified_users.add(
            user_id
        )


        # Verification session is complete.
        del verification_sessions[
            user_id
        ]


    # ------------------------------------------------
    # RETURN RESULT
    # ------------------------------------------------

    return result