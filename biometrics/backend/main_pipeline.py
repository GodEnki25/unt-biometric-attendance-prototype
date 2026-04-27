from backend.camera.camera_layer import Camera
from backend.verification.verification_layer import Verifier

import pickle


def run():

    # 🔹 Load database
    with open("database.pkl", "rb") as f:
        database = pickle.load(f)

    cam = Camera()
    cam.start()

    verifier = Verifier(database)

    print("System started...")

    try:
        while True:

            frame = cam.get_frame()

            if frame is None:
                continue

            result = verifier.process(frame)

            print(result)

            if result["status"] == "verified":
                print(f"🔥 VERIFIED: {result['user']}")
                break

    except KeyboardInterrupt:
        print("Stopping...")

    finally:
        cam.stop()


if __name__ == "__main__":
    run()