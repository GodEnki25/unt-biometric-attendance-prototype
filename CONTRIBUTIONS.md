# Team Contributions

This document tracks the contributions made by each team member throughout the development of the UNT Biometric Attendance.

## Sorel Agbogla (@GodEnki25)
### Capstone I
- Served as team lead.
- Developed and maintained database functionality.
- Contributed to backend development and integration.
- Developed end-to-end testing for the complete attendance workflow
- Managed portions of the project repository and team integrations.
- Managed Trello and team deadlines.
- Contributed to project documentation and development setup.

### Capstone II
### September 1, 2026 – Sorel Agbogla

- Integrated and tested the FastAPI backend with the current project build.
- Fixed backend import issues affecting the check-in route.
- Fixed OpenCV face detection configuration/dependency issues and verified successful face detection during check-in.
- Tested Tile38 geofence validation and confirmed location verification works.
- Successfully tested the full check-in flow and confirmed attendance records are saved to SQLite.
- Updated the `/checkins` API to return student names with attendance records.
- Updated attendance retrieval to use the `course_enrollments` roster and exclude instructor/TA accounts.
- Added support for displaying enrolled students without a check-in as `Absent`.
- Updated `/checkins` to retrieve attendance by specific session ID, preventing previous-session attendance from affecting the current session.
- Began integrating the instructor dashboard with live backend attendance data instead of hard-coded student records.
- Updated frontend API configuration for local/mobile backend connectivity and tested Expo tunnel access.
- Verified session-specific attendance results using session 34.

### October 23, 2026 – Sorel Agbogla

- Developed backend attendance duration calculations using geofence `ENTER`, `EXIT`, and `REENTER` events.
- Implemented tracking of first entry, latest entry, latest exit, and cumulative time spent inside the classroom.
- Updated the `/checkins` API to return attendance timestamps and total classroom duration for each student.
- Implemented live attendance duration updates during active sessions and ensured calculations stop when sessions end.
- Integrated backend attendance timestamps and duration data into the instructor dashboard.
- Updated the instructor dashboard to display First Entry Time, Latest Entry Time, Latest Exit Time, and Total Time in Class.
- Updated CSV attendance export to include all attendance timestamp and duration fields.
- Tested attendance tracking using Session 48, verifying that duration increased during the active session and stopped after the session ended.
- Restored existing student check-in status and instructor attendance override endpoints while preserving the new attendance calculations.
- Removed hardcoded course filtering to support attendance retrieval for different courses.

---

## Shayan Karki (@KarShyKi)

### Capstone I
- Developed biometric/facial-recognition functionality.
- Integratred facial recognition with the attendance workflow.
- Contributed to backend development and integration.
- Assisted with biometric testing.
- Contributed to project documentation and development setup.

### Capstone II
- [Add contributions throughout the semester.]

---

## Andrew Kim (@AndrewKim11889339)

### Capstone I
- Developed and refined the application's user interface and user experience.
- Implemented frontend screens and components.
- Contributed to frontend integration and application styling.
- Contributed to project documentation and development setup.

### Captone II
- Implemented the Instructor's Override functions
- Created the UI Design for the Instructor Dashboard
- Implemented separation of Instructor and Student access

---

## Andres Moreira (@aom0065)

### Captone I
- Developed and integrared the geofencing functionality.
- Implemented GPS-based classroom boundry validation.
- Contributed to FastAPI backend development and API integration.
- Integrated frontend check-in functionality with backend geofence validation.
- Assisted with testing and debugging the mobile check-in workflow.
- Contributed to project documentation and development setup.

### Capstone II


-

[Add contributions throughout the semester.]

> **GitHub identity note: ** One early project commit was authored by using Andres's personal GitHub identity, `@Mo-And-Byte`. Current and future project contributions use the school account `@aom0065`.

---
