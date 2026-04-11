import cv2
import numpy as np

def process_frame(image_bytes) -> dict:
    #converts bytes into an OpenVC image
    np_arr = np.frombuffer(image_bytes, np.unit8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        return {"ok": False, "error": "Invalid image"}
    
    #convert to grayscale (required for facial detection)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    #Load face detector
    face_cascade = cv2.CascadeClassifier (
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30)
    )

    return {
        "ok": True,
        "faces_detected": int(len(faces))
    }