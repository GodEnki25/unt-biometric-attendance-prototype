import numpy as np

def check_liveness(prev_embedding, current_embedding, threshold=0.02):

    if prev_embedding is None:
        return False

    diff = np.linalg.norm(current_embedding - prev_embedding)

    print("Liveness diff:", diff)

    if diff > threshold:
        return True
    else:
        return False