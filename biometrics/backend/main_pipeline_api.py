"""
Updated Main Pipeline - Uses API Backend instead of direct database access
Allows the biometric system to communicate with the centralized backend
"""

from camera.camera_layer import Camera
from detection.detection_layer import detect_faces
import requests
import time

API_URL = "http://localhost:8000"  # Update if API is on different machine

def verify_with_api(frame, threshold=0.75):
    """
    Send frame to detection and verify with API backend
    """
    try:
        # Detect faces
        faces = detect_faces(frame)
        
        if len(faces) != 1:
            return {"status": "no_face"}
        
        # Get embedding from detected face
        face = faces[0]
        embedding = face.embedding.tolist()
        
        # Send to API for verification
        response = requests.post(
            f"{API_URL}/verify",
            json={
                "embedding": embedding,
                "threshold": threshold
            },
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            if result["matched"]:
                return {
                    "status": "verified",
                    "user": result["username"],
                    "confidence": result["confidence"]
                }
            else:
                return {
                    "status": "scanning",
                    "confidence": result["confidence"],
                    "message": result["message"]
                }
        else:
            return {"status": "api_error", "message": response.text}
    
    except requests.exceptions.ConnectionError:
        return {"status": "api_offline", "message": "Cannot connect to API. Is it running?"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def run_with_api():
    """Run verification pipeline using API backend"""
    print("🔄 Starting Biometric Verification (API Mode)")
    print(f"📡 API Server: {API_URL}")
    
    # Check API health
    try:
        response = requests.get(f"{API_URL}/health", timeout=2)
        if response.status_code == 200:
            health = response.json()
            print(f"✓ API is healthy - {health['enrolled_users']} users enrolled")
        else:
            print("✗ API responded with error")
            return
    except requests.exceptions.ConnectionError:
        print(f"✗ Cannot connect to API at {API_URL}")
        print("   Make sure to start the API server first:")
        print("   python api_server.py")
        return
    
    cam = Camera()
    cam.start()
    
    print("System running... (Press Ctrl+C to stop)")
    print("Position your face in front of the camera")
    
    consecutive_matches = 0
    required_matches = 3  # Require 3 consecutive matches for verification
    
    try:
        while True:
            frame = cam.get_frame()
            
            if frame is None:
                time.sleep(0.1)
                continue
            
            result = verify_with_api(frame)
            
            print(f"[{time.strftime('%H:%M:%S')}] {result}")
            
            if result["status"] == "verified":
                consecutive_matches += 1
                if consecutive_matches >= required_matches:
                    print(f"\n🎉 VERIFIED: {result['user']} (Confidence: {result['confidence']:.3f})")
                    break
            else:
                consecutive_matches = 0
            
            time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n⏹️ Stopped by user")
    
    finally:
        cam.stop()


def run_local():
    """Original local pipeline without API (fallback)"""
    import pickle
    from verification.verification_layer import Verifier
    
    print("🔄 Starting Biometric Verification (Local Mode)")
    
    try:
        with open("database.pkl", "rb") as f:
            database = pickle.load(f)
    except FileNotFoundError:
        print("✗ database.pkl not found")
        print("   Create one using enrollment_script.py")
        return
    
    cam = Camera()
    cam.start()
    
    verifier = Verifier(database)
    
    print("System running...")
    
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
        print("Stopped")
    
    finally:
        cam.stop()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--local":
        run_local()
    else:
        # Try API mode first, fall back to local if API not available
        try:
            run_with_api()
        except Exception as e:
            print(f"API mode failed: {e}")
            print("Falling back to local mode...")
            run_local()
