"""
Enrollment Script - Creates facial embeddings database for verification
Run this script to enroll users into the system
"""

import cv2
import pickle
import os
from camera.camera_layer import Camera
from detection.detection_layer import detect_faces
from enrollment.enrollment_layer import process_embeddings

def enroll_user(username, num_samples=5):
    """
    Enroll a single user by capturing multiple face samples
    
    Args:
        username: Name of the user to enroll
        num_samples: Number of samples to capture (default 5)
    
    Returns:
        embedding: Processed face embedding for the user
    """
    print(f"\n--- Enrolling {username} ---")
    print(f"Please ensure your face is clearly visible in the camera")
    print(f"Starting in 3 seconds...")
    
    import time
    time.sleep(3)
    
    cam = Camera()
    cam.start()
    
    embeddings = []
    frames_captured = 0
    
    print(f"Capturing {num_samples} samples... (Press 'q' to skip)")
    
    try:
        while frames_captured < num_samples:
            frame = cam.get_frame()
            
            if frame is None:
                continue
            
            # Detect faces in the frame
            faces = detect_faces(frame)
            
            if len(faces) == 1:
                face = faces[0]
                embedding = face.embedding
                embeddings.append(embedding)
                frames_captured += 1
                
                # Draw bounding box
                bbox = face.bbox.astype(int)
                cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (0, 255, 0), 2)
                cv2.putText(frame, f"Sample {frames_captured}/{num_samples}", (bbox[0], bbox[1] - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                print(f"✓ Captured sample {frames_captured}/{num_samples}")
            
            elif len(faces) == 0:
                cv2.putText(frame, "No face detected", (50, 50),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            else:
                cv2.putText(frame, f"Multiple faces detected ({len(faces)})", (50, 50),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            # Display the frame
            cv2.imshow(f"Enrollment - {username}", frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                print("Enrollment skipped")
                cam.stop()
                cv2.destroyAllWindows()
                return None
    
    finally:
        cam.stop()
        cv2.destroyAllWindows()
    
    # Process embeddings
    if embeddings:
        final_embedding = process_embeddings(embeddings)
        print(f"✓ {username} enrolled successfully!")
        return final_embedding
    else:
        print(f"✗ Failed to enroll {username}")
        return None


def main():
    """Main enrollment workflow"""
    
    # Load existing database or create new one
    database_file = "database.pkl"
    
    if os.path.exists(database_file):
        with open(database_file, "rb") as f:
            database = pickle.load(f)
        print(f"Loaded existing database with {len(database)} users")
    else:
        database = {}
        print("Creating new database")
    
    print("\n=== Facial Recognition Enrollment System ===")
    
    while True:
        print("\nOptions:")
        print("1. Enroll a new user")
        print("2. List enrolled users")
        print("3. Delete a user")
        print("4. Exit and save")
        
        choice = input("Select option (1-4): ").strip()
        
        if choice == "1":
            username = input("Enter username: ").strip()
            if username in database:
                overwrite = input(f"{username} already exists. Overwrite? (y/n): ").strip().lower()
                if overwrite != 'y':
                    continue
            
            embedding = enroll_user(username)
            if embedding is not None:
                database[username] = embedding
                print(f"Database now has {len(database)} users")
        
        elif choice == "2":
            if database:
                print("\nEnrolled users:")
                for i, username in enumerate(database.keys(), 1):
                    print(f"  {i}. {username}")
            else:
                print("No users enrolled yet")
        
        elif choice == "3":
            if database:
                username = input("Enter username to delete: ").strip()
                if username in database:
                    del database[username]
                    print(f"Deleted {username}")
                else:
                    print(f"{username} not found")
            else:
                print("No users to delete")
        
        elif choice == "4":
            if database:
                # Save database
                with open(database_file, "wb") as f:
                    pickle.dump(database, f)
                print(f"\n✓ Database saved to {database_file} with {len(database)} users")
            else:
                print("Database is empty. Not saving.")
            break
        
        else:
            print("Invalid option")


if __name__ == "__main__":
    main()
