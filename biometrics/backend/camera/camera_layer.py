import cv2
import threading

class Camera:
    def __init__(self):
        self.cap = None
        self.running = False
        self.frame = None
        self.thread = None
    
    def start(self):
        """Start the camera in a separate thread"""
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            raise RuntimeError("Error: Could not open camera")
        self.running = True
        self.thread = threading.Thread(target=self._capture_frames, daemon=True)
        self.thread.start()
    
    def _capture_frames(self):
        """Capture frames continuously"""
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                self.frame = frame
            else:
                print("Failed to grab frame")
                break
    
    def get_frame(self):
        """Get the latest frame"""
        return self.frame
    
    def stop(self):
        """Stop the camera"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()

def start_camera():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera")
        return
    while True:
        ret, frame = cap.read()

        if not ret:
            print("Failed to grab frame")
            break
        cv2.imshow("Camera Feed", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    start_camera()