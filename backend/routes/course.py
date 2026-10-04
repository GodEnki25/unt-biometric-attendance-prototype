from fastapi import APIRouter, Depends

from backend.database.db import get_db_connection
from backend.services.token_service import require_instructor

router = APIRouter (prefix="/courses", tags=["courses"],)

@router.get("")
def get_courses(current_user=Depends(require_instructor),):
    
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """ 
            SELECT
                course_id,
                course_code,
                course_name,
                instructor_id
            FROM courses
            ORDER BY course_code
            """
        )

        rows = cursor.fetchall()

        return[{
                "course_id": row["course_id"],
                "course_code": row["course_code"],
                "course_name": row["course_name"],
                "instructor_id": row["instructor_id"],
            }
            for row in rows
        ]

    finally:
        conn.close()