import numpy as np
from biometrics.backend.detection.detection_layer import detect_faces
from backend.database.biometric_db import save_face_embedding

def process_embeddings(embeddings):

    embeddings = np.array(embeddings) #converting to numpy array for easier manipulation

    mean = np.mean(embeddings, axis=0) #calculating the mean embedding across all captures

    distances = np.linalg.norm(embeddings - mean, axis=1)# calculating the distance of each embedding from the mean

    filtered = embeddings[distances < np.mean(distances)]# filtering out embeddings that are too far from the mean (outliers)

    return np.mean(filtered, axis=0)

class EnrollmentManager:
    def __init__(self, required_captures=5):
        self.required_captures = required_captures
        self.sessions = {}

    def process(self, user_id, frame):
        faces = detect_faces(frame)
        if len(faces) != 1:
            return {
                "success": False,
                "message": "Invalid number of faces detected"       
            }
        face = faces[0]

        embedding = face.normed_embedding

        if user_id not in self.sessions:
            self.sessions[user_id] = []

        self.sessions[user_id].append(embedding)

        capture_count = len(self.sessions[user_id])

        if capture_count < self.required_captures:
            return {
                "status": "collecting",
                "captures": capture_count,
                "required": self.required_captures
            }
        final_embedding = process_embeddings(self.sessions[user_id])

        save_face_embedding(user_id, final_embedding)

        del self.sessions[user_id]
        return {
            "status": "completed",
            "message": "Enrollment successful",
            "user_id": user_id
        }
    