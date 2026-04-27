#!/usr/bin/env python3
"""Quick database viewer for biometric attendance system"""

import sqlite3
import sys
import os

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "backend", "database", "attendance.db")

def view_users():
    """View all enrolled users"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("\n" + "="*100)
        print("👥 ENROLLED USERS")
        print("="*100)
        
        cursor.execute("SELECT user_id, full_name, email, student_id, role FROM users ORDER BY user_id")
        rows = cursor.fetchall()
        
        if not rows:
            print("No users found")
        else:
            print(f"{'ID':>4} | {'Name':<25} | {'Email':<30} | {'Student ID':<12} | {'Role':<12}")
            print("-"*100)
            for row in rows:
                print(f"{row[0]:>4} | {row[1]:<25} | {row[2]:<30} | {row[3]:<12} | {row[4]:<12}")
        
        conn.close()
    except Exception as e:
        print(f"✗ Error: {e}")

def view_attendance():
    """View recent attendance records"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("\n" + "="*120)
        print("✅ ATTENDANCE RECORDS (Last 20)")
        print("="*120)
        
        cursor.execute("""
        SELECT 
            ar.attendance_id,
            u.full_name,
            ar.check_in_time,
            ar.face_verified,
            ar.location_verified,
            ar.status
        FROM attendance_records ar
        JOIN users u ON ar.student_id = u.user_id
        ORDER BY ar.check_in_time DESC
        LIMIT 20
        """)
        
        rows = cursor.fetchall()
        
        if not rows:
            print("No attendance records found")
        else:
            print(f"{'ID':>4} | {'Name':<25} | {'Check-in Time':<26} | {'Face':>4} | {'Loc':>4} | {'Status':<10}")
            print("-"*120)
            for row in rows:
                face = "✓" if row[3] else "✗"
                location = "✓" if row[4] else "✗"
                print(f"{row[0]:>4} | {row[1]:<25} | {row[2]:<26} | {face:>4} | {location:>4} | {row[5]:<10}")
        
        conn.close()
    except Exception as e:
        print(f"✗ Error: {e}")

def view_face_profiles():
    """View enrolled face profiles"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("\n" + "="*80)
        print("🔎 FACE PROFILES")
        print("="*80)
        
        cursor.execute("""
        SELECT 
            fp.face_profile_id,
            u.full_name,
            u.student_id,
            fp.created_at,
            LENGTH(fp.embedding_data) as embedding_size
        FROM face_profiles fp
        JOIN users u ON fp.user_id = u.user_id
        ORDER BY fp.created_at DESC
        """)
        
        rows = cursor.fetchall()
        
        if not rows:
            print("No face profiles found")
        else:
            print(f"{'ID':>4} | {'Name':<25} | {'Student ID':<12} | {'Enrolled':<26} | {'Size (bytes)':>12}")
            print("-"*80)
            for row in rows:
                print(f"{row[0]:>4} | {row[1]:<25} | {row[2]:<12} | {row[3]:<26} | {row[4]:>12}")
        
        conn.close()
    except Exception as e:
        print(f"✗ Error: {e}")

def view_statistics():
    """View database statistics"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("\n" + "="*80)
        print("📊 DATABASE STATISTICS")
        print("="*80)
        
        # Total users
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        # Enrolled users (with face)
        cursor.execute("SELECT COUNT(*) FROM face_profiles")
        enrolled_users = cursor.fetchone()[0]
        
        # Total attendance records
        cursor.execute("SELECT COUNT(*) FROM attendance_records")
        total_records = cursor.fetchone()[0]
        
        # Successful verifications
        cursor.execute("SELECT COUNT(*) FROM attendance_records WHERE face_verified = 1 AND status = 'verified'")
        successful = cursor.fetchone()[0]
        
        # Failed verifications
        cursor.execute("SELECT COUNT(*) FROM attendance_records WHERE face_verified = 0 OR status != 'verified'")
        failed = cursor.fetchone()[0]
        
        print(f"Total Users:              {total_users}")
        print(f"Enrolled Users (faces):   {enrolled_users}")
        print(f"Total Attendance Records: {total_records}")
        print(f"Successful Verifications: {successful}")
        print(f"Failed Verifications:     {failed}")
        
        if total_records > 0:
            success_rate = (successful / total_records) * 100
            print(f"Success Rate:             {success_rate:.1f}%")
        
        conn.close()
    except Exception as e:
        print(f"✗ Error: {e}")

def main():
    if not os.path.exists(DB_PATH):
        print(f"✗ Database not found at: {DB_PATH}")
        print("Run: python backend/database/init_db.py")
        return
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == 'users':
            view_users()
        elif command == 'attendance':
            view_attendance()
        elif command == 'faces':
            view_face_profiles()
        elif command == 'stats':
            view_statistics()
        elif command == 'all':
            view_users()
            view_face_profiles()
            view_statistics()
            view_attendance()
        else:
            print("Usage:")
            print("  python view_database.py users       # View all users")
            print("  python view_database.py attendance  # View attendance records")
            print("  python view_database.py faces       # View face profiles")
            print("  python view_database.py stats       # View statistics")
            print("  python view_database.py all         # View everything")
            print("  python view_database.py             # View users (default)")
    else:
        # Default: show everything
        view_users()
        view_face_profiles()
        view_statistics()
        view_attendance()

if __name__ == "__main__":
    main()
