import cv2
import numpy as np

def process_frame(image_bytes) -> dict:
    # converts bytes into an OpenCV image
    np_arr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        return {"verified": False, "confidence": 0.0, "error": "Invalid image"}

    # convert to grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # load face detector
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30)
    )

    faces_count = int(len(faces))

    return {
        "verified": faces_count > 0,
        "confidence": 1.0 if faces_count > 0 else 0.0,
        "faces_detected": faces_count
    }
