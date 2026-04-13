import cv2
from insightface.app import FaceAnalysis
import numpy as np

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def verify_user(stored_embedding):

    app = FaceAnalysis(providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(320, 320))

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Cannot open camera")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    print("Verification started. Look at the camera.")

    frame_count = 0
    faces = []

    while True:

        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        if frame_count % 5 == 0:
            small_frame = cv2.resize(frame, (640, 480))
            faces = app.get(small_frame)

        for face in faces:

            current_embedding = face.embedding

            similarity = cosine_similarity(stored_embedding, current_embedding)

            print("Similarity:", similarity)

            if similarity > 0.6:
                label = "MATCH ✅"
                color = (0, 255, 0)
            else:
                label = "NO MATCH ❌"
                color = (0, 0, 255)

            x1, y1, x2, y2 = face.bbox.astype(int)

            x_scale = frame.shape[1] / 640
            y_scale = frame.shape[0] / 480

            x1 = int(x1 * x_scale)
            y1 = int(y1 * y_scale)
            x2 = int(x2 * x_scale)
            y2 = int(y2 * y_scale)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            cv2.putText(frame, label, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        cv2.imshow("Verification", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    print("Run enrollment first to get stored embedding.")