import numpy as np

from biometrics.backend.detection.detection_layer import detect_faces
from biometrics.backend.liveness.liveness_layer import run_liveness_check


class Verifier:

    def __init__(self, stored_embedding, threshold=0.75):
        # Reference embedding retrieved from attendance.db
        self.stored_embedding = stored_embedding

        # Similarity required to consider the faces a match
        self.threshold = threshold

        # Number of consecutive successful matches
        self.counter = 0
        self.required_matches = 3


    def cosine_similarity(self, live_embedding):
        """
        Compare the live face embedding with the stored embedding.
        """

        return np.dot(
            live_embedding,
            self.stored_embedding
        ) / (
            np.linalg.norm(live_embedding)
            * np.linalg.norm(self.stored_embedding)
        )


    def process(self, frame):

        # 1. Detect faces in the current frame
        faces = detect_faces(frame)

        # We require exactly one face
        if len(faces) != 1:
            self.counter = 0

            return {
                "status": "no_face_detected"
            }


        # 2. Get the detected face
        face = faces[0]


        # 3. Get normalized InsightFace embedding
        live_embedding = face.normed_embedding


        # 4. Run anti-spoofing / liveness
        is_live = run_liveness_check(frame)

        if not is_live:
            self.counter = 0

            return {
                "status": "liveness_check_failed"
            }


        # 5. Compare live face with this user's stored face
        score = self.cosine_similarity(live_embedding)


        # 6. Check similarity threshold
        if score >= self.threshold:
            self.counter += 1

        else:
            self.counter = 0

            return {
                "status": "face_not_matched",
                "confidence": float(score)
            }


        # 7. Require several successful matches
        if self.counter >= self.required_matches:

            self.counter = 0

            return {
                "status": "verified",
                "confidence": float(score)
            }


        # Still waiting for enough successful frames
        return {
            "status": "scanning",
            "confidence": float(score),
            "matches": self.counter,
            "required": self.required_matches
        }