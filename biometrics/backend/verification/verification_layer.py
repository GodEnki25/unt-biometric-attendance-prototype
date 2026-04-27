from detection.detection_layer import detect_faces
from recognition.recognition_layer import recognize_face
from liveness.liveness_layer import check_liveness

import time

class Verifier:

    def __init__(self, database):
        self.database = database
        self.prev_bbox = None
        self.is_live = False
        self.counter = 0
        self.start_time = time.time()

    def process(self, frame):

        faces = detect_faces(frame)

        if len(faces) != 1:
            return {"status": "no_face"}

        face = faces[0]
        embedding = face.embedding
        bbox = face.bbox

        # Liveness
        if self.prev_bbox is None:
            self.prev_bbox = bbox
            return {"status": "initializing"}

        if check_liveness(self.prev_bbox, bbox):
            self.is_live = True

        self.prev_bbox = bbox

        if time.time() - self.start_time > 2:
            self.is_live = True

        # Recognition
        user, score = recognize_face(embedding, self.database)

        if user and self.is_live:
            self.counter += 1
        else:
            self.counter = 0

        if self.counter >= 5:
            return {
                "status": "verified",
                "user": user,
                "confidence": score
            }

        return {
            "status": "scanning",
            "confidence": score
        }