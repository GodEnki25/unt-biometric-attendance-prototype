from detection.detection_layer import detect_faces
from recognition.recognition_layer import recognize_face
from liveness.liveness_layer import run_liveness_check

class Verifier:
    def __init__(self, database):
        self.database = database
        self.is_live = False
        self.counter = 0
        self.required_matches = 3

    def process(self, frame):
        faces = detect_faces(frame)

        if len(faces) != 1:
            self.counter = 0
            return {
                "status": "no_face_detected",
            }
        face = faces[0]

        embedding = face.normed_embedding

        self.is_live = run_liveness_check(frame)

        if not self.is_live:
            self.counter = 0
            return {
                "status": "liveness_check_failed",
            }

        user,score = recognize_face(embedding, self.database)

        if user:
            self.counter += 1

        else:
            self.counter = 0

            return {
                "status": "user_not_recognized",
                "confidence": score,
            }

        if self.counter >= self.required_matches:
            self.counter = 0
            return {
                "status": "verified",
                "user": user,
                "confidence": score
            }
        return {
            "status": "scanning",
            "user": user,
            "confidence": score,
            "matches": self.counter
        }
    