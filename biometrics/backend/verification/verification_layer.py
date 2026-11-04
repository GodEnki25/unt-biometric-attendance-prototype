
import numpy as np
from time import monotonic

from biometrics.backend.detection.detection_layer import detect_faces
from biometrics.backend.enrollment.enrollment_layer import (
    extract_periocular_embedding
)
from biometrics.backend.liveness.liveness_layer import LivenessSession


EMBEDDING_DIM = 512
MIN_NORM = 1e-8
FACE_THRESHOLD = 0.60
REQUIRED_MATCHES = 3
PREPARE_SECONDS = 7.0
MAX_VERIFICATION_SECONDS = 90.0


class Verifier:

    def __init__(
        self,
        stored_embedding,
        threshold=FACE_THRESHOLD,
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
        self.required_matches = REQUIRED_MATCHES
        self.counter = 0

        self.started_at = monotonic()
        self.countdown_started = None

        self.liveness = None
        self.liveness_passed = False

        self.phase = "face_matching"
        self.finished = False

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

        return float(
            np.max(stored @ live)
        )

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

    def close(self):
        if self.liveness is not None:
            self.liveness.close()
            self.liveness = None

    def fail(self, reason):
        self.counter = 0
        self.finished = True
        self.phase = "failed"
        self.close()

        return {
            "status": "liveness_failed",
            "reason": reason
        }

    def process(self, frame):
        if self.finished:
            return {
                "status": "liveness_failed",
                "reason": "session_finished"
            }

        now = monotonic()

        if (
            now - self.started_at
            >= MAX_VERIFICATION_SECONDS
        ):
            return self.fail("verification_timeout")

        if (
            self.phase == "liveness"
            and self.liveness is not None
            and (
                now - self.liveness.step_started
                >= 7.0
            )
        ):
            return self.fail("challenge_timeout")

        if frame is None or frame.size == 0:
            if self.phase in (
                "face_matching",
                "final_confirmation"
            ):
                self.counter = 0

            return {
                "status": "no_face_detected"
            }

        faces = detect_faces(frame)

        if len(faces) != 1:
            if self.phase in (
                "face_matching",
                "final_confirmation"
            ):
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
            if self.phase in (
                "face_matching",
                "final_confirmation"
            ):
                self.counter = 0

            return {
                "status": "scanning",
                "confidence": 0.0,
                "matches": self.counter,
                "required": self.required_matches
            }

        try:
            face_score = self.cosine_similarity(
                live_embedding
            )

        except ValueError:
            if self.phase in (
                "face_matching",
                "final_confirmation"
            ):
                self.counter = 0

            return {
                "status": "scanning",
                "confidence": 0.0,
                "matches": self.counter,
                "required": self.required_matches
            }

        eye_score = self.periocular_similarity(
            frame,
            face
        )

        scores = {
            "confidence": face_score,
            "periocular_confidence": eye_score
        }

        if face_score < self.threshold:
            if self.phase in (
                "face_matching",
                "final_confirmation"
            ):
                self.counter = 0

            return {
                "status": "scanning",
                **scores,
                "matches": self.counter,
                "required": self.required_matches,
                "message": "Keep your face centered."
            }

        if self.phase == "face_matching":
            self.counter += 1

            print(
                f"[VERIFY] Initial face match "
                f"{self.counter}/{self.required_matches} "
                f"| Score={face_score:.4f}",
                flush=True
            )

            if self.counter < self.required_matches:
                return {
                    "status": "scanning",
                    **scores,
                    "matches": self.counter,
                    "required": self.required_matches
                }

            self.phase = "countdown"
            self.countdown_started = monotonic()
            self.counter = 0

            print(
                "[VERIFY] Face matched. "
                "Starting 7-second liveness countdown.",
                flush=True
            )

        if self.phase == "countdown":
            remaining = max(
                0.0,
                PREPARE_SECONDS - (
                    monotonic() - self.countdown_started
                )
            )

            if remaining > 0:
                return {
                    "status": "liveness_countdown",
                    **scores,
                    "seconds_remaining": remaining,
                    "message": (
                        "Face matched. "
                        "Liveness test will start shortly."
                    )
                }

            try:
                self.liveness = LivenessSession()

            except Exception as error:
                print(
                    f"[VERIFY] Liveness initialization error: "
                    f"{error}",
                    flush=True
                )

                return self.fail(
                    "liveness_initialization_failed"
                )

            self.phase = "liveness"

            print(
                "[VERIFY] Countdown completed. "
                "Starting randomized liveness challenges.",
                flush=True
            )

        if self.phase == "liveness":
            try:
                liveness_result = self.liveness.process(
                    frame
                )

            except Exception as error:
                print(
                    f"[VERIFY] Liveness processing error: "
                    f"{error}",
                    flush=True
                )

                return self.fail(
                    "liveness_processing_failed"
                )

            liveness_status = liveness_result.get(
                "status"
            )

            if liveness_status == "liveness_failed":
                reason = liveness_result.get(
                    "reason",
                    "challenge_failed"
                )

                return self.fail(reason)

            if liveness_status == "liveness_passed":
                self.liveness_passed = True
                self.phase = "final_confirmation"
                self.counter = 0
                self.close()

                print(
                    "[VERIFY] Liveness passed. "
                    "Starting final face confirmation.",
                    flush=True
                )

                return {
                    "status": "scanning",
                    **scores,
                    "matches": 0,
                    "required": self.required_matches,
                    "liveness": "passed"
                }

            return {
                **liveness_result,
                **scores,
                "matches": 0,
                "required": self.required_matches
            }

        if self.phase == "final_confirmation":
            if not self.liveness_passed:
                return self.fail(
                    "liveness_not_completed"
                )

            self.counter += 1

            print(
                f"[VERIFY] Final face match "
                f"{self.counter}/{self.required_matches} "
                f"| Score={face_score:.4f}",
                flush=True
            )

            if self.counter >= self.required_matches:
                self.finished = True
                self.phase = "verified"
                self.close()

                print(
                    "[VERIFY] Face and liveness verified.",
                    flush=True
                )

                return {
                    "status": "verified",
                    **scores,
                    "liveness": "passed"
                }

            return {
                "status": "scanning",
                **scores,
                "matches": self.counter,
                "required": self.required_matches,
                "liveness": "passed"
            }

        return self.fail(
            "invalid_verification_state"
        )
