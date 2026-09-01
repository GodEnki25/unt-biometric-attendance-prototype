from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from routes.auth_routes import router as auth_router
from routes.face import router as face_router
from routes.checkin import router as checkin_router
from routes.geofence import router as geofence_router

app = FastAPI(
    title="UNT Biometric Attendance Backend",
    version="1.0"
)

# Enable CORS so Expo/Web frontend can communicate with FastAPI backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routes
app.include_router(auth_router)
app.include_router(face_router)
app.include_router(checkin_router)
app.include_router(geofence_router)


# Root route (optional but good for testing)
@app.get("/")
def root():
    return {"message": "Backend is running"}
