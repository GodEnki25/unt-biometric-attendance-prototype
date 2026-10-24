
import cv2
import numpy as np

from biometrics.backend.detection.detection_layer import detect_faces
from backend.database.biometric_db import save_biometric_templates


EMBEDDING_DIM = 512
TEMPLATE_COUNT = 3
DUPLICATE_THRESHOLD = 0.9995
MIN_NORM = 1e-8

EYE_WIDTH = 128
EYE_HEIGHT = 64
MIN_EYE_DISTANCE = 24.0

HOG = cv2.HOGDescriptor(
    (EYE_WIDTH, EYE_HEIGHT),
    (16, 16),
    (8, 8),
    (8, 8),
    9
)


def normalize_embeddings(embeddings, dimension=None):

    vectors = np.asarray(
        embeddings,
        dtype=np.float32
    )

    if vectors.ndim == 1:
        vectors = vectors.reshape(1, -1)

    if vectors.ndim != 2:
        raise ValueError("Invalid embedding shape")

    if dimension is not None:
        if vectors.shape[1] != dimension:
            raise ValueError("Invalid embedding dimension")

    if not np.isfinite(vectors).all():
        raise ValueError("Non-finite embedding values")

    norms = np.linalg.norm(
        vectors,
        axis=1
    )

    if np.any(norms <= MIN_NORM):
        raise ValueError("Invalid embedding norm")

    return np.ascontiguousarray(
        vectors / norms[:, None],
        dtype=np.float32
    )


def extract_face_embedding(face):

    embedding = getattr(
        face,
        "normed_embedding",
        None
    )

    if embedding is None:
        return None

    try:
        return normalize_embeddings(
            embedding,
            EMBEDDING_DIM
        )[0]

    except ValueError:
        return None


def extract_periocular_region(frame, face):

    landmarks = getattr(
        face,
        "kps",
        None
    )

    if landmarks is None:
        return None

    landmarks = np.asarray(
        landmarks,
        dtype=np.float32
    )

    if landmarks.shape != (5, 2):
        return None

    if not np.isfinite(landmarks).all():
        return None

    left_eye = landmarks[0]
    right_eye = landmarks[1]

    eye_vector = right_eye - left_eye

    eye_distance = float(
        np.linalg.norm(eye_vector)
    )

    if eye_distance < MIN_EYE_DISTANCE:
        return None

    midpoint = (
        left_eye + right_eye
    ) / 2.0

    angle = np.degrees(
        np.arctan2(
            float(eye_vector[1]),
            float(eye_vector[0])
        )
    )

    height, width = frame.shape[:2]

    matrix = cv2.getRotationMatrix2D(
        tuple(midpoint.tolist()),
        float(angle),
        1.0
    )

    aligned = cv2.warpAffine(
        frame,
        matrix,
        (width, height),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT_101
    )

    region_width = eye_distance * 2.3
    region_height = eye_distance * 1.15

    center_x = float(midpoint[0])
    center_y = float(midpoint[1]) + eye_distance * 0.10

    x1 = int(center_x - region_width / 2)
    x2 = int(center_x + region_width / 2)

    y1 = int(center_y - region_height / 2)
    y2 = int(center_y + region_height / 2)

    if (
        x1 < 0 or y1 < 0
        or x2 > width or y2 > height
        or x2 <= x1 or y2 <= y1
    ):
        return None

    region = aligned[y1:y2, x1:x2]

    if region.size == 0:
        return None

    return cv2.resize(
        region,
        (EYE_WIDTH, EYE_HEIGHT),
        interpolation=cv2.INTER_AREA
    )


def extract_periocular_embedding(frame, face):

    region = extract_periocular_region(
        frame,
        face
    )

    if region is None:
        return None

    gray = cv2.cvtColor(
        region,
        cv2.COLOR_BGR2GRAY
    )

    gray = cv2.equalizeHist(gray)

    descriptor = HOG.compute(gray)

    if descriptor is None:
        return None

    try:
        return normalize_embeddings(
            np.asarray(
                descriptor,
                dtype=np.float32
            ).reshape(-1)
        )[0]

    except ValueError:
        return None


def select_representative_indices(
    embeddings,
    count=TEMPLATE_COUNT
):

    vectors = normalize_embeddings(
        embeddings,
        EMBEDDING_DIM
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

    valid_indices = np.flatnonzero(
        similarities >= threshold
    )

    if len(valid_indices) < count:
        raise ValueError(
            "Not enough consistent embeddings"
        )

    filtered = vectors[valid_indices]

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

    return valid_indices[selected]


def select_representative_embeddings(
    embeddings,
    count=TEMPLATE_COUNT
):

    vectors = normalize_embeddings(
        embeddings,
        EMBEDDING_DIM
    )

    indices = select_representative_indices(
        vectors,
        count
    )

    return np.ascontiguousarray(
        vectors[indices],
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

        session = self.sessions.setdefault(
            user_id,
            []
        )

        def progress(status, message):
            return {
                "status": status,
                "captures": len(session),
                "required": self.required_captures,
                "message": message
            }

        faces = detect_faces(frame)

        if len(faces) != 1:
            return progress(
                "invalid_face_count",
                "Please keep exactly one face visible."
            )

        face = faces[0]

        face_embedding = extract_face_embedding(
            face
        )

        if face_embedding is None:
            return progress(
                "embedding_failed",
                "Unable to extract facial embedding."
            )

        eye_embedding = extract_periocular_embedding(
            frame,
            face
        )

        if eye_embedding is None:
            return progress(
                "periocular_failed",
                "Keep both eyes visible and face the camera."
            )

        if session:

            previous_faces = np.asarray(
                [item[0] for item in session],
                dtype=np.float32
            )

            similarities = (
                previous_faces @ face_embedding
            )

            if np.any(
                similarities >= DUPLICATE_THRESHOLD
            ):
                return progress(
                    "duplicate_frame",
                    "Turn your head slightly."
                )

        session.append(
            (face_embedding, eye_embedding)
        )

        capture_count = len(session)

        if capture_count < self.required_captures:
            return {
                "status": "collecting",
                "captures": capture_count,
                "required": self.required_captures
            }

        try:

            face_samples = np.asarray(
                [item[0] for item in session],
                dtype=np.float32
            )

            eye_samples = np.asarray(
                [item[1] for item in session],
                dtype=np.float32
            )

            indices = select_representative_indices(
                face_samples,
                TEMPLATE_COUNT
            )

            final_face_embeddings = (
                normalize_embeddings(
                    face_samples[indices],
                    EMBEDDING_DIM
                )
            )

            final_eye_embeddings = (
                normalize_embeddings(
                    eye_samples[indices]
                )
            )

        except ValueError:

            self.sessions.pop(user_id, None)

            return {
                "status": "inconsistent_embeddings",
                "captures": 0,
                "required": self.required_captures,
                "message": (
                    "Biometric samples were inconsistent. "
                    "Please restart enrollment."
                )
            }

        try:

            save_biometric_templates(
                user_id,
                final_face_embeddings,
                final_eye_embeddings
            )

        except Exception:

            self.sessions.pop(user_id, None)
            raise

        self.sessions.pop(user_id, None)

        return {
            "status": "enrolled",
            "captures": self.required_captures,
            "templates": TEMPLATE_COUNT,
            "periocular_templates": TEMPLATE_COUNT,
            "message": "Enrollment successful",
            "user_id": user_id
        }
