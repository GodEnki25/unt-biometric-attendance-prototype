from backend.database.db import get_db_connection
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import sqlite3

ph = PasswordHasher()


def hash_password(password):
    return ph.hash(password)

def create_user(
    full_name,
    email,
    password,
    role,
    student_id
):

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            INSERT INTO users (
                full_name,
                email,
                password_hash,
                role,
                student_id
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                full_name,
                email,
                hash_password(password),
                role,
                student_id
            )
        )

        conn.commit()

        user_id = cursor.lastrowid

        return {
            "success": True,
            "user_id": user_id
        }

    except sqlite3.IntegrityError as error:

        print(
            "Create user error:",
            error
        )

        return {
            "success": False,
            "message": "Email or student ID already exists"
        }

    finally:

        conn.close()


def login_user(email, password):

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE email = ?",
        (email,)
    )

    user = cursor.fetchone()

    conn.close()


    if not user:
        return None


    try:
        ph.verify(user["password_hash"], password)
        return dict(user)
    except VerifyMismatchError:
        return None
