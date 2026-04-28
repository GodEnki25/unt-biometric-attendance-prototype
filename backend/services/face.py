import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from database.db import get_db_connection
import json

# Initialize InsightFace model once at startup
face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=0, det_size=(640, 640))

def bytes_to_image(image_bytes):
    np_arr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return frame

def get_embedding(image_bytes):
    frame = bytes_to_image(image_bytes)
    if frame is None:
        return None, "Invalid image"
    faces = face_app.get(frame)
    if len(faces) == 0:
        return None, "No face detected"
    if len(faces) > 1:
        return None, "Multiple faces detected"
    embedding = faces[0].embedding.tolist()
    return embedding, None

def enroll_face(user_id: int, image_bytes: bytes):
    embedding, error = get_embedding(image_bytes)
    if error:
        return {"success": False, "error": error}
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM face_profiles WHERE user_id = ?", (user_id,))
    existing = cursor.fetchone()
    embedding_json = json.dumps(embedding)
    if existing:
        cursor.execute(
            "UPDATE face_profiles SET embedding_path = ? WHERE user_id = ?",
            (embedding_json, user_id)
        )
    else:
        cursor.execute(
            "INSERT INTO face_profiles (user_id, embedding_path) VALUES (?, ?)",
            (user_id, embedding_json)
        )
    conn.commit()
    conn.close()
    return {"success": True, "message": "Face enrolled successfully"}

def verify_face(user_id: int, image_bytes: bytes):
    embedding, error = get_embedding(image_bytes)
    if error:
        return {"success": False, "verified": False, "error": error}
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT embedding_path FROM face_profiles WHERE user_id = ?", (user_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return {"success": False, "verified": False, "error": "No face enrolled for this user"}
    stored_embedding = np.array(json.loads(row["embedding_path"]))
    live_embedding = np.array(embedding)
    similarity = float(
        np.dot(stored_embedding, live_embedding) /
        (np.linalg.norm(stored_embedding) * np.linalg.norm(live_embedding))
    )
    threshold = 0.4
    verified = similarity >= threshold
    return {
        "success": True,
        "verified": verified,
        "similarity": round(similarity, 4),
        "message": "Face verified" if verified else "Face did not match"
    }

def process_frame(image_bytes) -> dict:
    frame = bytes_to_image(image_bytes)
    if frame is None:
        return {"verified": False, "confidence": 0.0, "error": "Invalid image"}
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    faces_count = int(len(faces))
    return {
        "verified": faces_count > 0,
        "confidence": 1.0 if faces_count > 0 else 0.0,
        "faces_detected": faces_count
    }
