import cv2

def start_camera():

    # Open default camera
    cap = cv2.VideoCapture(0)

    # Check if camera opened successfully
    if not cap.isOpened():
        print("Error: Cannot open camera")
        return

    # Set camera resolution (HD)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    # Set FPS (may depend on hardware)
    cap.set(cv2.CAP_PROP_FPS, 30)

    print("Camera started. Press 'q' to exit.")

    while True:

        # Capture frame
        ret, frame = cap.read()

        if not ret:
            print("Failed to grab frame")
            break

        # Display frame
        cv2.imshow("Camera Feed", frame)

        # Exit when 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Exiting camera...")
            break

    # Release camera
    cap.release()

    # Close all OpenCV windows
    cv2.destroyAllWindows()


if __name__ == "__main__":
    start_camera()