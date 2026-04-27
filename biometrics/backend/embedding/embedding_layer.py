from insightface.app import FaceAnalysis
import numpy as np

app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=0)

def get_embedding(face_img):
    faces = app.get(face_img)
    if len(faces) == 0:
        return None

    return faces[0].embedding.astype(np.float32)