
import cv2
import numpy as np
from insightface.app import FaceAnalysis


DETECTION_SIZE = (640, 640)
DETECTION_THRESHOLD = 0.40
MIN_FACE_SIZE = 60


face_app = FaceAnalysis(
    providers=["CPUExecutionProvider"],
    allowed_modules=["detection", "recognition"]
)

face_app.prepare(
    ctx_id=-1,
    det_thresh=DETECTION_THRESHOLD,
    det_size=DETECTION_SIZE
)


def enhance_lighting(frame):

    lab = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2LAB
    )

    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    enhanced_l = clahe.apply(l)

    enhanced = cv2.merge(
        (enhanced_l, a, b)
    )

    return cv2.cvtColor(
        enhanced,
        cv2.COLOR_LAB2BGR
    )


def valid_face(face, frame_shape):

    height, width = frame_shape[:2]

    bbox = getattr(
        face,
        "bbox",
        None
    )

    if bbox is None or len(bbox) != 4:
        return False

    x1, y1, x2, y2 = bbox

    if not np.isfinite(bbox).all():
        return False

    face_width = max(
        0.0,
        min(float(x2), width) - max(float(x1), 0)
    )

    face_height = max(
        0.0,
        min(float(y2), height) - max(float(y1), 0)
    )

    if (
        face_width < MIN_FACE_SIZE
        or face_height < MIN_FACE_SIZE
    ):
        return False

    embedding = getattr(
        face,
        "normed_embedding",
        None
    )

    if embedding is None:
        return False

    embedding = np.asarray(
        embedding
    )

    if embedding.shape != (512,):
        return False

    return bool(
        np.isfinite(embedding).all()
    )


def detect_faces(frame):

    if frame is None:
        return []

    if not isinstance(frame, np.ndarray):
        return []

    if frame.ndim != 3 or frame.shape[2] != 3:
        return []

    if frame.dtype != np.uint8:
        return []

    if frame.size == 0:
        return []

    height, width = frame.shape[:2]

    if height < 160 or width < 160:
        return []

    faces = face_app.get(frame)

    valid_faces = [
        face
        for face in faces
        if valid_face(face, frame.shape)
    ]

    if valid_faces:
        return valid_faces

    enhanced = enhance_lighting(frame)

    faces = face_app.get(enhanced)

    return [
        face
        for face in faces
        if valid_face(face, enhanced.shape)
    ]
