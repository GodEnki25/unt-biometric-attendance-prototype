
import numpy as np

from biometrics.backend.detection.detection_layer import detect_faces
from backend.database.biometric_db import save_face_embedding


EMBEDDING_DIM = 512
TEMPLATE_COUNT = 3
DUPLICATE_THRESHOLD = 0.9995
MIN_NORM = 1e-8


def normalize_embeddings(embeddings):

    vectors = np.asarray(
        embeddings,
        dtype=np.float32
    )

    if vectors.ndim == 1:
        vectors = vectors.reshape(1, -1)

    if vectors.ndim != 2:
        raise ValueError("Invalid embedding shape")

    if vectors.shape[1] != EMBEDDING_DIM:
        raise ValueError("Invalid embedding dimension")

    if not np.isfinite(vectors).all():
        raise ValueError("Non-finite embedding values")

    norms = np.linalg.norm(
        vectors,
        axis=1
    )

    if np.any(norms <= MIN_NORM):
        raise ValueError("Invalid embedding norm")

    return (
        vectors / norms[:, None]
    ).astype(np.float32)


def select_representative_embeddings(
    embeddings,
    count=TEMPLATE_COUNT
):

    vectors = normalize_embeddings(
        embeddings
    )

    if len(vectors) < count:
        raise ValueError("Not enough embeddings")

    center = np.mean(
        vectors,
        axis=0
    )

    center_norm = np.linalg.norm(center)

    if center_norm <= MIN_NORM:
        raise ValueError("Invalid embedding center")

    center = center / center_norm

    similarities = vectors @ center

    median = np.median(similarities)

    mad = np.median(
        np.abs(similarities - median)
    )

    threshold = median - max(
        3.0 * mad,
        0.02
    )

    filtered = vectors[
        similarities >= threshold
    ]

    if len(filtered) < count:
        raise ValueError(
            "Not enough consistent embeddings"
        )

    center = np.mean(
        filtered,
        axis=0
    )

    center_norm = np.linalg.norm(center)

    if center_norm <= MIN_NORM:
        raise ValueError("Invalid filtered center")

    center = center / center_norm

    first = int(
        np.argmax(filtered @ center)
    )

    selected = [first]

    while len(selected) < count:

        remaining = [
            i for i in range(len(filtered))
            if i not in selected
        ]

        best_index = min(
            remaining,
            key=lambda i: max(
                float(filtered[i] @ filtered[j])
                for j in selected
            )
        )

        selected.append(best_index)

    return np.ascontiguousarray(
        filtered[selected],
        dtype=np.float32
    )


class EnrollmentManager:

    def __init__(self, required_captures=7):

        if required_captures < TEMPLATE_COUNT:
            raise ValueError(
                "Required captures must be at least 3"
            )

        self.required_captures = required_captures

        self.sessions = {}


    def process(self, user_id, frame):

        if frame is None or frame.size == 0:

            return {
                "status": "invalid_frame",
                "message": "Invalid camera frame."
            }

        faces = detect_faces(frame)

        if len(faces) != 1:

            return {
                "status": "invalid_face_count",
                "captures": len(
                    self.sessions.get(user_id, [])
                ),
                "required": self.required_captures,
                "message": (
                    "Please make sure exactly "
                    "one face is visible."
                )
            }

        face = faces[0]

        embedding = face.normed_embedding

        if embedding is None:

            return {
                "status": "embedding_failed",
                "captures": len(
                    self.sessions.get(user_id, [])
                ),
                "required": self.required_captures,
                "message": (
                    "Unable to extract facial embedding."
                )
            }

        try:

            embedding = normalize_embeddings(
                embedding
            )[0]

        except ValueError:

            return {
                "status": "invalid_embedding",
                "captures": len(
                    self.sessions.get(user_id, [])
                ),
                "required": self.required_captures,
                "message": "Invalid facial embedding."
            }

        if user_id not in self.sessions:
            self.sessions[user_id] = []

        session = self.sessions[user_id]

        if session:

            similarities = np.array([
                float(np.dot(previous, embedding))
                for previous in session
            ])

            if np.any(
                similarities >= DUPLICATE_THRESHOLD
            ):

                return {
                    "status": "duplicate_frame",
                    "captures": len(session),
                    "required": self.required_captures,
                    "message": (
                        "Move your head slightly "
                        "for another angle."
                    )
                }

        session.append(embedding)

        capture_count = len(session)

        if capture_count < self.required_captures:

            return {
                "status": "collecting",
                "captures": capture_count,
                "required": self.required_captures
            }

        try:

            final_embeddings = (
                select_representative_embeddings(
                    session,
                    count=TEMPLATE_COUNT
                )
            )

        except ValueError:

            self.sessions.pop(user_id, None)

            return {
                "status": "inconsistent_embeddings",
                "captures": 0,
                "required": self.required_captures,
                "message": (
                    "Face samples were inconsistent. "
                    "Please restart enrollment."
                )
            }

        try:

            save_face_embedding(
                user_id,
                final_embeddings
            )

        except Exception:

            self.sessions.pop(user_id, None)
            raise

        self.sessions.pop(user_id, None)

        return {
            "status": "enrolled",
            "captures": self.required_captures,
            "templates": TEMPLATE_COUNT,
            "message": "Enrollment successful",
            "user_id": user_id
        }
