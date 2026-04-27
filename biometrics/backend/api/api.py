from fastapi import FastAPI
import numpy as np
import base64
import cv2

from backend.database.db import get_db_connection
from biometrics.backend.detection.detection_layer import detect_face_and_embedding

app = FastAPI()


# ------------------------
# Utils
# ------------------------
def decode_image(b64_string):
    img_bytes = base64.b64decode(b64_string)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


def check_liveness(embeddings):
    if len(embeddings) < 2:
        return False

    diffs = [
        np.linalg.norm(embeddings[i] - embeddings[i - 1])
        for i in range(1, len(embeddings))
    ]

    print("Movement:", diffs)
    return np.mean(diffs) > 5


# ------------------------
# ENROLL
# ------------------------
@app.post("/enroll")
async def enroll(data: dict):
    user_id = data["user_id"]
    frames = data["frames"]

    print("\n===== ENROLL DEBUG =====")
    print("FRAMES RECEIVED:", len(frames))

    embeddings = []

    for i, f in enumerate(frames):
        image = decode_image(f)

        if image is None:
            print(f"Frame {i}: decode failed ❌")
            continue

        face, emb = detect_face_and_embedding(image)

        if face is None:
            print(f"Frame {i}: NO FACE ❌")
            continue
        else:
            print(f"Frame {i}: FACE ✅")

        if emb is None:
            print(f"Frame {i}: NO EMBEDDING ❌")
            continue
        else:
            print(f"Frame {i}: EMBEDDING ✅")

        embeddings.append(emb.astype(np.float32))

    print("VALID EMBEDDINGS:", len(embeddings))
    print("========================\n")

    if len(embeddings) < 5:
        return {"status": "fail", "message": "Not enough valid frames"}

    if not check_liveness(embeddings):
        return {"status": "fail", "message": "Spoof detected"}

    final_embedding = embeddings[-1]

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users
        SET face_embedding = ?
        WHERE user_id = ?
    """, (final_embedding.tobytes(), user_id))

    conn.commit()
    conn.close()

    return {"status": "success", "message": "Enrolled successfully"}


# ------------------------
# VERIFY
# ------------------------
@app.post("/verify")
async def verify(data: dict):
    user_id = data["user_id"]
    frames = data["frames"]

    embeddings = []

    for f in frames:
        image = decode_image(f)
        face, emb = detect_face_and_embedding(image)

        if emb is not None:
            embeddings.append(emb.astype(np.float32))

    if len(embeddings) == 0:
        return {"status": "fail", "message": "No face detected"}

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT face_embedding FROM users WHERE user_id=?", (user_id,))
    row = cursor.fetchone()

    if not row:
        return {"status": "fail", "message": "User not found"}

    stored_embedding = np.frombuffer(row[0], dtype=np.float32)

    score = np.linalg.norm(embeddings[-1] - stored_embedding)

    print("MATCH SCORE:", score)

    if score < 0.6:
        return {"status": "success", "message": "Verified"}
    else:
        return {"status": "fail", "message": "Not matched"}


# ------------------------
# ROOT
# ------------------------
@app.get("/")
def home():
    return {"message": "API running"}