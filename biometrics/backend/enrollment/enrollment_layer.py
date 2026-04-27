import numpy as np


def process_embeddings(embeddings):
    """
    Process multiple embeddings into a single averaged embedding
    
    Args:
        embeddings: List of face embeddings (512-dimensional)
    
    Returns:
        numpy.ndarray: Averaged embedding
    """
    if not embeddings:
        raise ValueError("No embeddings provided")
    
    embeddings = np.array(embeddings)
    
    # Calculate mean embedding
    mean = np.mean(embeddings, axis=0)
    
    # Filter outliers (optional)
    distances = np.linalg.norm(embeddings - mean, axis=1)
    filtered = embeddings[distances < np.mean(distances) * 1.5]
    
    if len(filtered) == 0:
        # If all filtered out, use all
        return mean
    
    # Return refined mean
    return np.mean(filtered, axis=0)


if __name__ == "__main__":
    print("enrollment_layer.py is a library module.")
    print("Use enrollment_script.py to enroll users.")