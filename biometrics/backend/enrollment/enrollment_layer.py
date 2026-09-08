import numpy as np

from biometrics.backend.detection.detection_layer import detect_faces
from backend.database.biometric_db import save_face_embedding


def process_embeddings(embeddings):

    # Convert collected embeddings into NumPy array
    embeddings = np.array(embeddings)

    # Calculate average face embedding
    mean = np.mean(
        embeddings,
        axis=0
    )

    # Calculate how far each embedding is from the mean
    distances = np.linalg.norm(
        embeddings - mean,
        axis=1
    )

    # Calculate average distance
    average_distance = np.mean(distances)

    # Keep embeddings that are close to the average
    filtered = embeddings[
        distances <= average_distance
    ]

    # Safety check in case filtering removes everything
    if len(filtered) == 0:
        filtered = embeddings

    # Average the valid embeddings
    final_embedding = np.mean(
        filtered,
        axis=0
    )

    # Normalize final embedding
    norm = np.linalg.norm(final_embedding)

    if norm > 0:
        final_embedding = final_embedding / norm

    return final_embedding


class EnrollmentManager:

    def __init__(self, required_captures=10):

        self.required_captures = required_captures

        # Stores enrollment frames separately
        # for each user
        self.sessions = {}


    def process(self, user_id, frame):

        # Detect faces in current frame
        faces = detect_faces(frame)


        # Enrollment requires exactly one face
        if len(faces) != 1:

            return {
                "status": "invalid_face_count",
                "message": "Please make sure exactly one face is visible."
            }


        face = faces[0]


        # InsightFace normalized face embedding
        embedding = face.normed_embedding


        # Start a new enrollment session
        # if this is the first valid frame
        if user_id not in self.sessions:

            self.sessions[user_id] = []


        # Save current valid embedding
        self.sessions[user_id].append(
            embedding
        )


        # Number of valid captures collected
        capture_count = len(
            self.sessions[user_id]
        )


        # Continue collecting until 10
        if capture_count < self.required_captures:

            return {
                "status": "collecting",
                "captures": capture_count,
                "required": self.required_captures
            }


        # Process all collected embeddings
        final_embedding = process_embeddings(
            self.sessions[user_id]
        )


        # Store final biometric embedding
        save_face_embedding(
            user_id,
            final_embedding
        )


        # Enrollment is finished.
        # Remove temporary session.
        del self.sessions[user_id]


        return {
            "status": "enrolled",
            "captures": self.required_captures,
            "message": "Enrollment successful",
            "user_id": user_id
        }
