import numpy as np

def check_liveness(prev_bbox, current_bbox, threshold=3):

    if prev_bbox is None:
        return False

    movement = np.linalg.norm(current_bbox - prev_bbox)
    return movement > threshold