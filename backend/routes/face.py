from fastapi import APIRouter, UploadFile, File
from services.face import process_frame

router = APIRouter(prefix="/face", tags=["face"])

@router.post("/check")
async def face_check(file: UploadFile = File(...)):
    contents = await file.read()
    result = process_frame(contents)
    return result