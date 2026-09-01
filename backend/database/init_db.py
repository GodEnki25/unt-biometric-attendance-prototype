import sys
import os
from db import get_db_connection

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('student', 'instructor', 'admin')) NOT NULL,
        student_id TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS courses (
        course_id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_code TEXT NOT NULL,
        course_name TEXT NOT NULL,
        instructor_id INTEGER,
        FOREIGN KEY (instructor_id) REFERENCES users(user_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS course_enrollments (
        enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER,
        student_id INTEGER,
        FOREIGN KEY (course_id) REFERENCES courses(course_id),
        FOREIGN KEY (student_id) REFERENCES users(user_id),
        UNIQUE(course_id, student_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance_sessions (
        session_id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER,
        session_date TEXT,
        start_time TEXT,
        end_time TEXT,
        geofence_lat REAL,
        geofence_lng REAL,
        geofence_radius REAL,
        FOREIGN KEY (course_id) REFERENCES courses(course_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance_records (
        attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        student_id INTEGER,
        check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        face_verified INTEGER,
        location_verified INTEGER,
        status TEXT,
        FOREIGN KEY (session_id) REFERENCES attendance_sessions(session_id),
        FOREIGN KEY (student_id) REFERENCES users(user_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS face_profiles (
        face_profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        embedding_path BLOB,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
    """)

    conn.commit()
    conn.close()

    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()
