import numpy as np

def process_embeddings(embeddings):

    embeddings = np.array(embeddings)

    mean = np.mean(embeddings, axis=0)
    distances = np.linalg.norm(embeddings - mean, axis=1)

    filtered = embeddings[distances < np.mean(distances)]

    return np.mean(filtered, axis=0)