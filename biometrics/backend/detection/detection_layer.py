from insightface.app import FaceAnalysis

face_app = FaceAnalysis(providers=['CPUExecutionProvider'])
face_app.prepare(ctx_id=-1, det_size=(320, 320))


def detect_faces(frame):
    return face_app.get(frame)