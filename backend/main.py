from fastapi import FastAPI

# Import routers
from routes.auth_routes import router as auth_router
from routes.face import router as face_router
from routes.checkin import router as checkin_router

app = FastAPI(
    title="UNT Biometric Attendance Backend",
    version="1.0"
)

# Include all routes
app.include_router(auth_router)
app.include_router(face_router)
app.include_router(checkin_router)


# Root route (optional but good for testing)
@app.get("/")
def root():
    return {"message": "Backend is running"}
