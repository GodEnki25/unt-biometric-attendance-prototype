from backend.database.db import get_db_connection
import numpy as np


def save_face_embedding(user_id, embedding):
    conn = get_db_connection()
    cursor = conn.cursor()

    embedding_blob = embedding.astype(np.float32).tobytes()

    cursor.execute("""
        INSERT INTO face_profiles (user_id, embedding_path)
        VALUES (?, ?)
        ON CONFLICT(user_id)
        DO UPDATE SET embedding_path = excluded.embedding_path
    """, (user_id, embedding_blob))

    conn.commit()
    conn.close()


def get_face_embedding(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT embedding_path
        FROM face_profiles
        WHERE user_id = ?
    """, (user_id,))

    result = cursor.fetchone()
    conn.close()

    if result is None or result["embedding_path"] is None:
        return None

    return np.frombuffer(
        result["embedding_path"],
        dtype=np.float32
    )