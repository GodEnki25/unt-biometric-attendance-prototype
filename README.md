# UNT Biometric Attendance Prototype

This project implements a mobile-based classroom presence verification system that combines facial recognition and geofencing to assist instructors with attendance management. The system is designed as an academic prototype and operates independently of the Canvas database while maintaining a Canvas-aligned attendance model.

Attendance verification occurs only when a student’s device enters a predefined classroom boundary. Facial recognition is used as a confirmation step rather than a continuous monitoring mechanism. Instructors retain full authority to manually adjust or override attendance records.

---

## Design Principles

- Mobile-first implementation using on-device sensors
- Classroom boundary detection instead of continuous location tracking
- Face scanning used only at check-in time
- No direct access to Canvas databases
- Instructor-controlled attendance authority
- Privacy-conscious, opt-in operation

---

## Core Capabilities

- Mobile face scanning for attendance confirmation
- Geofence-based classroom entry and exit detection
- Timestamped arrival and departure events
- Local attendance record storage using a Canvas-aligned schema
- Instructor dashboard for manual edits and corrections
- Exportable attendance records for LMS entry or review

---

## System Components

- **/mobile**  
  Student-facing mobile application for geofence detection and face scanning

- **/backend**  
  Local API services, attendance record storage, and business logic

- **/ml**  
  On-device or local biometric recognition pipeline

- **/frontend**  
  Instructor dashboard for attendance review and overrides

- **/docs**  
  Project charter, system vision, and architecture documentation

---

## Execution Model

The system does not connect directly to Canvas databases. Attendance records are stored locally and structured to mirror Canvas attendance formats. This allows realistic demonstration without requiring institutional API permissions.

Location services are used only to detect classroom boundary entry and exit events. No continuous location tracking or background monitoring is performed.

---

## Project Status

Sprint 0 – Architecture definition, SDLC setup, and mobile workflow planning
