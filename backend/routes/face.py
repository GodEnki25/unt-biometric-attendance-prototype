from fastapi import APIRouter, UploadFile, File, Form
from services.face import process_frame, enroll_face, verify_face

router = APIRouter(prefix="/face", tags=["face"])

@router.post("/check")
async def face_check(file: UploadFile = File(...)):
    contents = await file.read()
    result = process_frame(contents)
    return result

@router.post("/enroll")
async def face_enroll(
    user_id: int = Form(...),
    file: UploadFile = File(...)
):
    contents = await file.read()
    result = enroll_face(user_id, contents)
    return result

@router.post("/verify")
async def face_verify(
    user_id: int = Form(...),
    file: UploadFile = File(...)
):
    contents = await file.read()
    result = verify_face(user_id, contents)
    return result