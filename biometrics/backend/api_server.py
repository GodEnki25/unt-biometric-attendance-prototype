"""
Biometric Attendance Backend API
FastAPI server for facial recognition enrollment and verification
Database accessible to entire application
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import pickle
import os
import numpy as np
import json
from datetime import datetime

app = FastAPI(title="Biometric Attendance Backend")

# CORS middleware - allows access from frontend and mobile apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8081", "http://127.0.0.1:*", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Configuration ---
# Central database location accessible to entire application
DATABASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
DATABASE_FILE = os.path.join(DATABASE_DIR, "enrollment_database.pkl")
VERIFICATION_LOG = os.path.join(DATABASE_DIR, "verification_log.json")

# Ensure data directory exists
os.makedirs(DATABASE_DIR, exist_ok=True)

# --- In-memory database (loaded from pickle) ---
USERS_DATABASE: Dict[str, List[float]] = {}

def load_database():
    """Load enrollment database from pickle file"""
    global USERS_DATABASE
    if os.path.exists(DATABASE_FILE):
        try:
            with open(DATABASE_FILE, "rb") as f:
                USERS_DATABASE = pickle.load(f)
            print(f"✓ Loaded database with {len(USERS_DATABASE)} users from {DATABASE_FILE}")
        except Exception as e:
            print(f"✗ Error loading database: {e}")
            USERS_DATABASE = {}
    else:
        USERS_DATABASE = {}
        print(f"No existing database found at {DATABASE_FILE}")

def save_database():
    """Save enrollment database to pickle file"""
    try:
        with open(DATABASE_FILE, "wb") as f:
            pickle.dump(USERS_DATABASE, f)
        print(f"✓ Database saved to {DATABASE_FILE} with {len(USERS_DATABASE)} users")
    except Exception as e:
        print(f"✗ Error saving database: {e}")
        raise

def log_verification(username: str, success: bool, confidence: float):
    """Log verification attempts"""
    try:
        logs = []
        if os.path.exists(VERIFICATION_LOG):
            with open(VERIFICATION_LOG, "r") as f:
                logs = json.load(f)
        
        logs.append({
            "timestamp": datetime.now().isoformat(),
            "username": username,
            "success": success,
            "confidence": confidence
        })
        
        with open(VERIFICATION_LOG, "w") as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        print(f"Error logging verification: {e}")

# Load database on startup
load_database()


# --- Pydantic Models ---
class EnrollmentRequest(BaseModel):
    username: str
    embedding: List[float]  # 512-dimensional face embedding

class EnrollmentResponse(BaseModel):
    success: bool
    message: str
    username: str

class UserInfo(BaseModel):
    username: str
    enrolled_at: Optional[str] = None

class DatabaseStatus(BaseModel):
    total_users: int
    users: List[str]
    database_file: str
    database_dir: str

class VerificationRequest(BaseModel):
    embedding: List[float]
    threshold: float = 0.75

class VerificationResponse(BaseModel):
    matched: bool
    username: Optional[str] = None
    confidence: float
    message: str


# --- API Endpoints ---

@app.get("/", tags=["Info"])
async def root():
    """Root endpoint - API status"""
    return {
        "name": "Biometric Attendance Backend",
        "version": "1.0",
        "status": "running",
        "docs": "/docs",
        "database_location": DATABASE_FILE
    }

@app.get("/health", tags=["Health"])
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "enrolled_users": len(USERS_DATABASE),
        "database_file_exists": os.path.exists(DATABASE_FILE)
    }

@app.get("/database/status", tags=["Database"])
async def database_status():
    """Get database status and list of enrolled users"""
    return DatabaseStatus(
        total_users=len(USERS_DATABASE),
        users=list(USERS_DATABASE.keys()),
        database_file=DATABASE_FILE,
        database_dir=DATABASE_DIR
    )

@app.post("/enroll", tags=["Enrollment"])
async def enroll(request: EnrollmentRequest):
    """
    Enroll a new user with face embedding
    
    Example:
    {
        "username": "john_doe",
        "embedding": [0.1, 0.2, ..., 0.5]  # 512 numbers
    }
    """
    username = request.username.strip()
    embedding = np.array(request.embedding)
    
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    
    if len(embedding) != 512:
        raise HTTPException(status_code=400, detail=f"Embedding must be 512-dimensional, got {len(embedding)}")
    
    # Check if user already exists
    if username in USERS_DATABASE:
        return EnrollmentResponse(
            success=False,
            message=f"User '{username}' already enrolled. Delete first to re-enroll.",
            username=username
        )
    
    # Add user to database
    USERS_DATABASE[username] = embedding.tolist()
    
    # Save to disk
    save_database()
    
    return EnrollmentResponse(
        success=True,
        message=f"User '{username}' enrolled successfully",
        username=username
    )

@app.post("/verify", tags=["Verification"])
async def verify(request: VerificationRequest):
    """
    Verify a face embedding against enrolled users
    
    Example:
    {
        "embedding": [0.1, 0.2, ..., 0.5],  # 512 numbers
        "threshold": 0.75
    }
    """
    embedding = np.array(request.embedding)
    threshold = request.threshold
    
    if len(embedding) != 512:
        raise HTTPException(status_code=400, detail=f"Embedding must be 512-dimensional, got {len(embedding)}")
    
    if not USERS_DATABASE:
        return VerificationResponse(
            matched=False,
            confidence=0.0,
            message="No users enrolled in the system"
        )
    
    # Calculate similarity with all enrolled users
    best_score = 0
    best_user = None
    
    for username, db_embedding in USERS_DATABASE.items():
        db_embedding = np.array(db_embedding)
        
        # Cosine similarity
        score = np.dot(embedding, db_embedding) / (np.linalg.norm(embedding) * np.linalg.norm(db_embedding))
        
        if score > best_score:
            best_score = score
            best_user = username
    
    # Check if match exceeds threshold
    matched = best_score > threshold if best_user else False
    
    # Log verification attempt
    log_verification(best_user or "unknown", matched, float(best_score))
    
    return VerificationResponse(
        matched=matched,
        username=best_user if matched else None,
        confidence=float(best_score),
        message=f"Verified as {best_user}" if matched else f"No match (best: {best_score:.2f})"
    )

@app.get("/users", tags=["Users"])
async def list_users():
    """List all enrolled users"""
    return {
        "total": len(USERS_DATABASE),
        "users": list(USERS_DATABASE.keys())
    }

@app.delete("/users/{username}", tags=["Users"])
async def delete_user(username: str):
    """Delete an enrolled user"""
    username = username.strip()
    
    if username not in USERS_DATABASE:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    
    del USERS_DATABASE[username]
    save_database()
    
    return {
        "success": True,
        "message": f"User '{username}' deleted",
        "remaining_users": len(USERS_DATABASE)
    }

@app.get("/logs", tags=["Logs"])
async def get_logs(limit: int = 50):
    """Get verification logs"""
    if not os.path.exists(VERIFICATION_LOG):
        return {"logs": [], "total": 0}
    
    with open(VERIFICATION_LOG, "r") as f:
        logs = json.load(f)
    
    # Return last 'limit' entries
    return {
        "logs": logs[-limit:],
        "total": len(logs)
    }

@app.post("/clear-database", tags=["Database"])
async def clear_database():
    """Clear all enrolled users (WARNING: destructive operation)"""
    global USERS_DATABASE
    USERS_DATABASE = {}
    save_database()
    
    return {
        "success": True,
        "message": "Database cleared",
        "remaining_users": len(USERS_DATABASE)
    }


# --- Startup Event ---
@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("🚀 Biometric Attendance Backend API Starting")
    print(f"📁 Database location: {DATABASE_FILE}")
    print(f"👥 Enrolled users: {len(USERS_DATABASE)}")
    print("=" * 60)
    print("\nAPI Documentation: http://localhost:8000/docs")
    print("=" * 60)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
