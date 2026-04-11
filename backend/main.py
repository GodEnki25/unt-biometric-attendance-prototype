from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.face import router as face_router
from routes.checkin import router as checkin_router

app = FastAPI(title="UNT Biometric Attendance Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face_router)
app.include_router(checkin_router)

@app.get("/")
def root():
    return {"status": "backend running"}