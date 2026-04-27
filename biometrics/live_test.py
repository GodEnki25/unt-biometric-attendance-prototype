import cv2
import requests
import base64
import time

URL_ENROLL = "http://127.0.0.1:8000/enroll"
URL_VERIFY = "http://127.0.0.1:8000/verify"

USER_ID = 1


def capture_frames(n=10):
    cap = cv2.VideoCapture(0)
    frames = []

    print("\n📸 Look straight at camera (good lighting)")
    time.sleep(2)

    for i in range(n):
        ret, frame = cap.read()

        if not ret:
            continue

        frame = cv2.resize(frame, (640, 480))

        cv2.imshow("Camera", frame)

        _, img = cv2.imencode('.jpg', frame)
        b64 = base64.b64encode(img.tobytes()).decode("utf-8")

        frames.append(b64)

        print(f"Captured {i+1}/{n}")

        cv2.waitKey(1000)

    cap.release()
    cv2.destroyAllWindows()

    return frames


def enroll():
    frames = capture_frames()

    payload = {"user_id": USER_ID, "frames": frames}

    print("Sending ENROLL:", len(frames))
    res = requests.post(URL_ENROLL, json=payload)

    print("ENROLL RESPONSE:", res.json())


def verify():
    frames = capture_frames()

    payload = {"user_id": USER_ID, "frames": frames}

    print("Sending VERIFY:", len(frames))
    res = requests.post(URL_VERIFY, json=payload)

    print("VERIFY RESPONSE:", res.json())


if __name__ == "__main__":
    print("1 = Enroll")
    print("2 = Verify")

    choice = input("> ")

    if choice == "1":
        enroll()
    elif choice == "2":
        verify()