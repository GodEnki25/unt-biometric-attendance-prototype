import numpy as np

# calculating the cosine similarity between two vectors (angular distance)
# higher values indicate smaller angular distance (more similar)
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def recognize_face(embedding, database, threshold=0.75):

    best_score = 0
    best_user = None

    for name, db_embedding in database.items():
        score = cosine_similarity(embedding, db_embedding)

        if score > best_score:
            best_score = score
            best_user = name

    if best_score > threshold:
        return best_user, best_score

    return None, best_score