
import numpy as np

from biometrics.backend.detection.detection_layer import detect_faces
from biometrics.backend.enrollment.enrollment_layer import extract_periocular_embedding


EMBEDDING_DIM = 512
MIN_NORM = 1e-8


class Verifier:

    def __init__(
        self,
        stored_embedding,
        threshold=0.75,
        stored_periocular_embedding=None
    ):

        self.stored_embeddings = self.normalize_embeddings(
            stored_embedding,
            dimension=EMBEDDING_DIM
        )

        if self.stored_embeddings.shape[0] not in (1, 3):
            raise ValueError(
                "Expected one or three full-face embeddings."
            )

        self.stored_periocular_embeddings = None

        if stored_periocular_embedding is not None:
            self.stored_periocular_embeddings = (
                self.normalize_embeddings(
                    stored_periocular_embedding
                )
            )

            if self.stored_periocular_embeddings.shape[0] != 3:
                raise ValueError(
                    "Expected three periocular embeddings."
                )

        self.threshold = threshold
        self.counter = 0
        self.required_matches = 3

    @staticmethod
    def normalize_embeddings(embeddings, dimension=None):

        vectors = np.asarray(
            embeddings,
            dtype=np.float32
        )

        if vectors.ndim == 1:
            vectors = vectors.reshape(1, -1)

        if vectors.ndim != 2:
            raise ValueError(
                "Invalid embedding dimensions."
            )

        if (
            dimension is not None
            and vectors.shape[1] != dimension
        ):
            raise ValueError(
                "Incorrect embedding dimension."
            )

        if vectors.shape[1] == 0:
            raise ValueError(
                "Empty embedding."
            )

        if not np.isfinite(vectors).all():
            raise ValueError(
                "Embedding contains invalid values."
            )

        norms = np.linalg.norm(
            vectors,
            axis=1
        )

        if np.any(norms <= MIN_NORM):
            raise ValueError(
                "Invalid embedding norm."
            )

        return np.ascontiguousarray(
            vectors / norms[:, None],
            dtype=np.float32
        )

    @staticmethod
    def compare_embeddings(stored, live):

        if stored.shape[1] != live.shape[0]:
            raise ValueError(
                "Embedding dimensions do not match."
            )

        scores = stored @ live

        return float(np.max(scores))

    def cosine_similarity(self, live_embedding):

        live = self.normalize_embeddings(
            live_embedding,
            dimension=EMBEDDING_DIM
        )[0]

        return self.compare_embeddings(
            self.stored_embeddings,
            live
        )

    def periocular_similarity(self, frame, face):

        if self.stored_periocular_embeddings is None:
            return None

        live_embedding = extract_periocular_embedding(
            frame,
            face
        )

        if live_embedding is None:
            return None

        try:
            live = self.normalize_embeddings(
                live_embedding
            )[0]

            return self.compare_embeddings(
                self.stored_periocular_embeddings,
                live
            )

        except ValueError:
            return None

    def process(self, frame):

        if frame is None or frame.size == 0:
            self.counter = 0

            return {
                "status": "no_face_detected"
            }

        faces = detect_faces(frame)

        if len(faces) != 1:
            self.counter = 0

            return {
                "status": "no_face_detected"
            }

        face = faces[0]

        live_embedding = getattr(
            face,
            "normed_embedding",
            None
        )

        if live_embedding is None:
            self.counter = 0

            return {
                "status": "face_not_matched",
                "confidence": 0.0
            }

        try:
            face_score = self.cosine_similarity(
                live_embedding
            )

        except ValueError:
            self.counter = 0

            return {
                "status": "face_not_matched",
                "confidence": 0.0
            }

        eye_score = self.periocular_similarity(
            frame,
            face
        )

        biometric_scores = {
            "confidence": face_score,
            "periocular_confidence": eye_score
        }

        if face_score < self.threshold:
            self.counter = 0

            return {
                "status": "face_not_matched",
                **biometric_scores
            }

        self.counter += 1

        if self.counter >= self.required_matches:
            self.counter = 0

            return {
                "status": "verified",
                **biometric_scores
            }

        return {
            "status": "scanning",
            **biometric_scores,
            "matches": self.counter,
            "required": self.required_matches
        }
