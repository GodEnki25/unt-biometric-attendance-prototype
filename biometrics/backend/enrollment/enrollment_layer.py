import cv2
from insightface.app import FaceAnalysis
import numpy as np

def enroll_user():

    app = FaceAnalysis(providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(320, 320))

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Cannot open camera")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    print("Enrollment started. Look at the camera.")

    embeddings = []
    frame_count = 0
    faces = []

    while True:

        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # Run detection every 5 frames
        if frame_count % 5 == 0:
            small_frame = cv2.resize(frame, (640, 480))
            faces = app.get(small_frame)

        for face in faces:

            embedding = face.embedding
            embeddings.append(embedding)

            print(f"Captured {len(embeddings)} samples")

            # Draw box
            x1, y1, x2, y2 = face.bbox.astype(int)

            x_scale = frame.shape[1] / 640
            y_scale = frame.shape[0] / 480

            x1 = int(x1 * x_scale)
            y1 = int(y1 * y_scale)
            x2 = int(x2 * x_scale)
            y2 = int(y2 * y_scale)

            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            cv2.putText(frame, f"Samples: {len(embeddings)}",
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6,
                        (0,255,0), 2)

        cv2.imshow("Enrollment", frame)

        # Stop after 20 samples
        if len(embeddings) >= 20:
            print("Enough samples collected")
            break

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    # Compute final embedding
    final_embedding = np.mean(embeddings, axis=0)

    print("Final embedding created")
    print("First 5 values:", final_embedding[:5])

    return final_embedding


if __name__ == "__main__":
    enroll_user()