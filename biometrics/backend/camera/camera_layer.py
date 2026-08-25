import cv2
import threading

class Camera:
    def __init__(self):
        self.cap = None
        self.running = False
        self.frame = None
        self.thread = None
    
    # Start the camera
    def start(self):
        """Start the camera in a separate thread"""
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            raise RuntimeError("Error: Could not open camera")
        self.running = True
        self.thread = threading.Thread(target=self._capture_frames, daemon=True)
        self.thread.start()

    # Capture frames continuously in a separate thread
    def _capture_frames(self):
        """Capture frames continuously"""
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                self.frame = frame
            else:
                print("Failed to grab frame")
                break
        
    # Get the latest frame
    def get_frame(self):
        """Get the latest frame"""
        return self.frame

    # Stop the camera
    def stop(self):
        """Stop the camera"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    camera = Camera()
    camera.start()  