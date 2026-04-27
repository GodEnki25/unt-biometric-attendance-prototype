import numpy as np

def compare_embeddings(emb1, emb2):
    emb1 = emb1 / np.linalg.norm(emb1)
    emb2 = emb2 / np.linalg.norm(emb2)

    return float(np.dot(emb1, emb2))