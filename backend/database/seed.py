from database.db import get_db_connection
import hashlib



def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def seed_data():
    conn = get_db_connection()
    cursor = conn.cursor()

    # ======================
    # USERS
    # ======================

    # Instructor
    cursor.execute("""
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
    """, (
        "Diana Rabah",
        "diana@unt.edu",
        hash_password("password123"),
        "instructor"
    ))
    instructor_id = cursor.lastrowid

    
    cursor.execute("""
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
    """, (
        "Jordan Black",
        "jordan@unt.edu",
        hash_password("password123"),
        "instructor"
    ))
    ta_id = cursor.lastrowid

    # Students
    students = [
        ("Sorel Agbogla", "sorel@unt.edu", "100001"),
        ("Andres Moreira", "andres@unt.edu", "100002"),
        ("Andrew Kim", "andrew@unt.edu", "100003"),
        ("Shayan Karki", "shayan@unt.edu", "100004")
    ]

    student_ids = []

    for name, email, sid in students:
        cursor.execute("""
        INSERT INTO users (full_name, email, password_hash, role, student_id)
        VALUES (?, ?, ?, ?, ?)
        """, (
            name,
            email,
            hash_password("password123"),
            "student",
            sid
        ))
        student_ids.append(cursor.lastrowid)

    # ======================
    # COURSE
    # ======================

    cursor.execute("""
    INSERT INTO courses (course_code, course_name, instructor_id)
    VALUES (?, ?, ?)
    """, (
        "CSCE 4901",
        "Capstone",
        instructor_id
    ))

    course_id = cursor.lastrowid

    # ======================
    # ENROLLMENTS
    # ======================

    for student_id in student_ids:
        cursor.execute("""
        INSERT INTO course_enrollments (course_id, student_id)
        VALUES (?, ?)
        """, (course_id, student_id))

    conn.commit()
    conn.close()

    print("Seed data inserted successfully.")


if __name__ == "__main__":
    seed_data()
