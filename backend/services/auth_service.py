from database.db import get_db_connection
import hashlib


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def login_user(email, password):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    conn.close()

    if not user:
        return None

    if user["password_hash"] == hash_password(password):
        return dict(user)

    return None
