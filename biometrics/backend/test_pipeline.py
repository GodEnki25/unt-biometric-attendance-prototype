import cv2
import numpy as np
import time
from insightface.app import FaceAnalysis

# 🔹 Cosine Similarity
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


# 🔹 Liveness (Spike-based)
def check_liveness(prev_bbox, current_bbox, threshold=3):

    if prev_bbox is None:
        return False

    diff = np.linalg.norm(current_bbox - prev_bbox)
    return diff > threshold


# 🔹 In-memory DB
sample_db = {}


# 🔹 ENROLLMENT
def enroll_user(app, cap):

    print("\n=== ENROLLMENT STARTED ===")
    print("Look straight at the camera...")

    embeddings = []
    count = 0

    while count < 20:

        ret, frame = cap.read()
        if not ret:
            continue

        faces = app.get(frame)

        if len(faces) != 1:
            cv2.putText(frame, "Ensure ONE face only", (50,50),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)
            cv2.imshow("Enrollment", frame)
            continue

        face = faces[0]
        embeddings.append(face.embedding)
        count += 1

        print(f"Captured {count}/20")

        x1, y1, x2, y2 = face.bbox.astype(int)
        cv2.rectangle(frame, (x1,y1),(x2,y2),(0,255,0),2)

        cv2.imshow("Enrollment", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # 🔥 Outlier filtering
    embeddings = np.array(embeddings)
    mean = np.mean(embeddings, axis=0)
    distances = np.linalg.norm(embeddings - mean, axis=1)

    filtered = embeddings[distances < np.mean(distances)]
    final_embedding = np.mean(filtered, axis=0)

    name = input("\nEnter user name: ")
    sample_db[name] = final_embedding

    print(f"User '{name}' enrolled successfully!")

    # 🔥 SHOW SUCCESS SCREEN
    success_img = np.zeros((300,600,3), dtype=np.uint8)
    cv2.putText(success_img, "ENROLLMENT SUCCESS", (50,150),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)
    cv2.imshow("Enrollment Complete", success_img)
    cv2.waitKey(2000)

    # 🔥 CLOSE CAMERA AFTER ENROLLMENT
    cap.release()
    cv2.destroyAllWindows()

    print("Enrollment camera closed.\n")


# 🔹 ATTENDANCE
def mark_attendance(user):
    print(f"\n✅ Attendance marked for {user}")


# 🔹 VERIFICATION
def verify_user(app):

    print("=== VERIFICATION STARTED ===")

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Camera error")
        return

    prev_bbox = None
    frame_count = 0
    is_live = False
    start_time = time.time()

    verification_counter = 0
    REQUIRED_FRAMES = 5

    while True:

        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        faces = app.get(frame)

        if len(faces) != 1:
            cv2.imshow("Verification", frame)
            continue

        face = faces[0]

        current_embedding = face.embedding
        current_bbox = face.bbox

        # 🔥 LIVENESS
        if prev_bbox is None:
            prev_bbox = current_bbox
            continue

        if frame_count % 5 == 0:
            if check_liveness(prev_bbox, current_bbox):
                is_live = True

        prev_bbox = current_bbox

        if time.time() - start_time > 2:
            is_live = True

        # 🔥 MATCHING
        best_score = 0
        best_user = None

        for name, db_embedding in sample_db.items():
            score = cosine_similarity(current_embedding, db_embedding)
            if score > best_score:
                best_score = score
                best_user = name

        print("Similarity:", best_score)

        # 🔥 MULTI-FRAME VERIFICATION
        if best_score > 0.75 and is_live:
            verification_counter += 1
        else:
            verification_counter = 0

        # 🔥 SUCCESS CONDITION
        if verification_counter >= REQUIRED_FRAMES:

            print(f"\n🔥 VERIFIED USER: {best_user}")
            mark_attendance(best_user)

            # 🔥 SHOW SUCCESS SCREEN
            success_frame = frame.copy()
            cv2.putText(success_frame, "VERIFIED SUCCESSFULLY",
                        (50,100), cv2.FONT_HERSHEY_SIMPLEX,
                        1, (0,255,0), 3)

            cv2.imshow("Verification", success_frame)
            cv2.waitKey(2000)

            cap.release()
            cv2.destroyAllWindows()
            return

        # 🔹 UI display
        if best_score > 0.75:
            match_label = f"{best_user} ({best_score:.2f})"
            color = (0,255,0)
        else:
            match_label = f"Unknown ({best_score:.2f})"
            color = (0,0,255)

        live_label = "Live" if is_live else "Scanning"
        label = f"{match_label} | {live_label}"

        x1, y1, x2, y2 = current_bbox.astype(int)

        cv2.rectangle(frame, (x1,y1),(x2,y2), color, 2)
        cv2.putText(frame, label, (x1,y1-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        cv2.imshow("Verification", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


# 🔹 MAIN
def run_pipeline():

    app = FaceAnalysis(providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(320, 320))

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Camera error")
        return

    enroll_user(app, cap)
    verify_user(app)


if __name__ == "__main__":
    run_pipeline()