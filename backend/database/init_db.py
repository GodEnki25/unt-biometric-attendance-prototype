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
    CREATE TABLE IF NOT EXISTS geofence_status_changes (
        status_change_id INTEGER PRIMARY KEY AUTOINCREMENT,
        attendance_id INTEGER NOT NULL,
        event_type TEXT NOT NULL
            CHECK(event_type IN ('ENTER', 'EXIT', 'REENTER')),
        event_time TEXT NOT NULL,
        FOREIGN KEY (attendance_id)
            REFERENCES attendance_records(attendance_id)
            ON DELETE CASCADE
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

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        target_user_id INTEGER,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(user_id),
        FOREIGN KEY (target_user_id) REFERENCES users(user_id)
        );
        """)

    cursor.execute("PRAGMA table_info(users)")
    user_columns = {
        row[1] for row in cursor.fetchall()
    }

    if "is_active" not in user_columns:
        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1
        """)

    if "is_root_admin" not in user_columns:
        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN is_root_admin INTEGER NOT NULL DEFAULT 0
        """)

    cursor.execute("PRAGMA table_info(courses)")
    course_columns = {
        row[1] for row in cursor.fetchall()
    }

    if "is_active" not in course_columns:
        cursor.execute("""
            ALTER TABLE courses
            ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1
        """)

    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS
        idx_single_root_admin
        ON users(is_root_admin)
        WHERE is_root_admin = 1
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS protect_root_update
        BEFORE UPDATE ON users
        WHEN OLD.is_root_admin = 1
        BEGIN
            SELECT RAISE(
                ABORT,
                'Root administrator is protected'
            );
        END
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS protect_root_delete
        BEFORE DELETE ON users
        WHEN OLD.is_root_admin = 1
        BEGIN
            SELECT RAISE(
                ABORT,
                'Root administrator cannot be deleted'
            );
        END
    """)

    conn.commit()
    conn.close()

    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()
