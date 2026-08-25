import numpy as np

def process_embeddings(embeddings):

    embeddings = np.array(embeddings) #converting to numpy array for easier manipulation

    mean = np.mean(embeddings, axis=0) #calculating the mean embedding across all captures

    distances = np.linalg.norm(embeddings - mean, axis=1)# calculating the distance of each embedding from the mean

    filtered = embeddings[distances < np.mean(distances)]# filtering out embeddings that are too far from the mean (outliers)

    return np.mean(filtered, axis=0)