import numpy as np
import cv2

def check_liveness(face_img):
    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)

    # Simple but effective: texture + brightness variance
    variance = np.var(gray)

    # 🔥 Tune this threshold later
    if variance < 50:
        return False

    return True