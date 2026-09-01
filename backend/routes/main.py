from fastapi import FastAPI
from routes.auth_routes import router as auth_router
from biometrics.backend.api import router as biometric_router

app = FastAPI()

app.include_router(auth_router)
app.include_router(biometric_router)