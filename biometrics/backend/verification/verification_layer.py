
import numpy as np

from biometrics.backend.detection.detection_layer import detect_faces


class Verifier:

    def __init__(self, stored_embedding, threshold=0.75):

        embeddings = np.asarray(
            stored_embedding,
            dtype=np.float32
        )

        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)

        if (
            embeddings.ndim != 2
            or embeddings.shape[1] != 512
            or embeddings.shape[0] not in (1, 3)
        ):
            raise ValueError(
                "Expected one or three 512-dimensional embeddings."
            )

        if not np.isfinite(embeddings).all():
            raise ValueError(
                "Stored embeddings contain invalid values."
            )

        norms = np.linalg.norm(
            embeddings,
            axis=1
        )

        if np.any(norms <= 1e-8):
            raise ValueError(
                "Stored embeddings have invalid norms."
            )

        self.stored_embeddings = (
            embeddings / norms[:, None]
        )

        self.threshold = threshold
        self.counter = 0
        self.required_matches = 3


    def cosine_similarity(self, live_embedding):

        live_embedding = np.asarray(
            live_embedding,
            dtype=np.float32
        ).reshape(-1)

        if (
            live_embedding.shape[0] != 512
            or not np.isfinite(live_embedding).all()
        ):
            raise ValueError(
                "Invalid live embedding."
            )

        norm = np.linalg.norm(live_embedding)

        if norm <= 1e-8:
            raise ValueError(
                "Invalid live embedding norm."
            )

        live_embedding = live_embedding / norm

        scores = self.stored_embeddings @ live_embedding

        return float(np.max(scores))


    def process(self, frame):

        faces = detect_faces(frame)

        if len(faces) != 1:
            self.counter = 0

            return {
                "status": "no_face_detected"
            }

        face = faces[0]

        live_embedding = face.normed_embedding

        if live_embedding is None:
            self.counter = 0

            return {
                "status": "face_not_matched",
                "confidence": 0.0
            }

        try:
            score = self.cosine_similarity(
                live_embedding
            )

        except ValueError:
            self.counter = 0

            return {
                "status": "face_not_matched",
                "confidence": 0.0
            }

        # Liveness is currently disabled.
        # Restore before production deployment.

        if score >= self.threshold:
            self.counter += 1

        else:
            self.counter = 0

            return {
                "status": "face_not_matched",
                "confidence": score
            }

        if self.counter >= self.required_matches:
            self.counter = 0

            return {
                "status": "verified",
                "confidence": score
            }

        return {
            "status": "scanning",
            "confidence": score,
            "matches": self.counter,
            "required": self.required_matches
        }
