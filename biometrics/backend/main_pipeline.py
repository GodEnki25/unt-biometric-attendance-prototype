from camera.camera_layer import Camera
from verification.verification_layer import Verifier
from db_integration import BiometricsDatabaseManager, init_face_profiles_table
import pickle
import sys
import os

# Initialize database schema if needed
init_face_profiles_table()


def run_with_database(student_id=None, course_id=None, session_id=None):
    """
    Run verification pipeline with database integration
    
    Args:
        student_id: Optional student ID for attendance recording
        course_id: Optional course ID to get active session
        session_id: Optional attendance session ID
    """
    
    print("🔄 Starting Biometric Verification with Database Integration")
    
    # 🔹 Initialize database manager
    db_manager = BiometricsDatabaseManager()
    
    # 🔹 Load face recognition database (pickle)
    try:
        with open("database.pkl", "rb") as f:
            face_database = pickle.load(f)
        print(f"✓ Loaded face database with {len(face_database)} enrolled users")
    except FileNotFoundError:
        print("✗ database.pkl not found. Run enrollment_script.py first")
        db_manager.close()
        return
    
    # 🔹 Get active session if not provided
    if session_id is None and course_id:
        session = db_manager.get_active_session(course_id)
        if session:
            session_id = session['session_id']
            print(f"✓ Using active session: {session_id}")
        else:
            print("⚠ No active attendance session found")
    
    # 🔹 Start camera
    cam = Camera()
    cam.start()
    
    verifier = Verifier(face_database)
    
    print("System running... Position your face in front of camera")
    print(f"Student ID: {student_id}, Session ID: {session_id}")
    
    verified_user = None
    confidence = 0
    
    try:
        while True:
            frame = cam.get_frame()
            
            if frame is None:
                continue
            
            result = verifier.process(frame)
            
            print(f"[Status: {result.get('status')}] Confidence: {result.get('confidence', 0):.3f}")
            
            if result["status"] == "verified":
                verified_user = result['user']
                confidence = result['confidence']
                print(f"\n✅ VERIFIED: {verified_user} (Confidence: {confidence:.3f})")
                break
    
    except KeyboardInterrupt:
        print("\n⏹️ Stopped by user")
    
    finally:
        cam.stop()
    
    # 🔹 Record attendance if verification successful
    if verified_user and session_id:
        try:
            # Find user in database by name (from face recognition)
            # This assumes user full_name matches the pickle database key
            student = db_manager.get_user_by_student_id(student_id) if student_id else None
            
            if student:
                # Record attendance in database
                db_manager.record_attendance(
                    session_id=session_id,
                    student_id=student['user_id'],
                    face_verified=True,
                    location_verified=True,
                    status="verified"
                )
                print(f"✓ Attendance recorded in database")
            else:
                print(f"⚠ Could not find student record for: {student_id}")
        
        except Exception as e:
            print(f"✗ Error recording attendance: {e}")
    
    db_manager.close()
    
    return {
        "verified": verified_user is not None,
        "user": verified_user,
        "confidence": confidence
    }


def run_local():
    """Original local pipeline without database (fallback)"""
    
    print("🔄 Starting Biometric Verification (Local Mode)")
    
    # 🔹 Load database
    try:
        with open("database.pkl", "rb") as f:
            database = pickle.load(f)
    except FileNotFoundError:
        print("✗ database.pkl not found")
        return
    
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


def run():
    """Main entry point - tries database mode, falls back to local"""
    try:
        # Check if we can access the backend database
        from db_integration import BiometricsDatabaseManager
        print("Database integration available")
        
        # You can optionally pass parameters here
        # run_with_database(student_id="12345", course_id=1, session_id=1)
        run_with_database()
    except ImportError:
        print("Database integration not available, using local mode")
        run_local()


if __name__ == "__main__":
    # Parse command line arguments if provided
    if len(sys.argv) > 1:
        if sys.argv[1] == "--local":
            run_local()
        elif sys.argv[1] == "--student" and len(sys.argv) > 3:
            student_id = sys.argv[2]
            course_id = int(sys.argv[3])
            session_id = int(sys.argv[4]) if len(sys.argv) > 4 else None
            run_with_database(student_id=student_id, course_id=course_id, session_id=session_id)
        else:
            print("Usage:")
            print("  python main_pipeline.py                     # Run with database")
            print("  python main_pipeline.py --local             # Run without database")
            print("  python main_pipeline.py --student ID COURSE [SESSION]  # Run with specific student")
    else:
        run()