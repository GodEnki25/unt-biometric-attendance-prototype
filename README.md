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

/mobile – Student-facing mobile application  
/backend – API services, attendance record storage, and business logic  
/ml – On-device or local biometric recognition pipeline  
/frontend – Instructor dashboard for attendance review and overrides  
/docs – Project charter, system vision, and architecture documentation  

---

## Execution Model

The system does not connect directly to Canvas databases. Attendance records are stored locally and structured to mirror Canvas attendance formats. This allows realistic demonstration without requiring institutional API permissions.

Location services are used only to detect classroom boundary entry and exit events. No continuous location tracking or background monitoring is performed.

---

## Project Progress

### Sprint 0 – Foundation & Setup

- Defined system architecture and system workflow  
- Created GitHub repository and structured project directories  
- Initialized Trello board for task and sprint management  
- Established Software Development Life Cycle (SDLC) approach  
- Drafted Project Charter and System Vision documentation  

---

### Sprint 1 – Requirements & Planning

- Developed Requirement Matrix with individual ownership  
- Created User Stories for all system roles:
  - Instructor  
  - Student  
  - Admin  

- Defined System Requirements Specification (SRS)  
- Built Project Plan document  
- Created Work Breakdown Structure (WBS)  
- Identified project risks, assumptions, and constraints  

---

### Sprint 2 – System Design & Prototype

- Designed annotated wireframes for key screens:
  - Login / Enrollment screen  
  - Student face scan interface  
  - Student dashboard  
  - Instructor dashboard  

- Developed non-interactive UI prototypes  
- Created system design diagrams:
  - System Architecture Diagram  
  - Data Flow Diagram (DFD)  
  - Entity Relationship Diagram (ERD)  
  - Class Diagram  
  - State Transition Diagram  

- Defined biometric processing workflow:
  - Initial enrollment captures and stores a facial template  
  - Subsequent scans are compared against stored templates  
  - Matching is performed locally using edge processing  

- Designed system features:
  - Geofence-based attendance validation  
  - Session-based attendance tracking  
  - Instructor-controlled overrides and edits  
  - CSV export for attendance reporting  

---

## Current Status

The project is currently in the **Design Phase**, with all major system components, workflows, and interfaces defined. The next phase will focus on development, integration, and testing of the system.

---

## Privacy & Ethics Considerations

- Facial recognition operates on an opt-in basis  
- Biometric data is processed locally (no cloud storage)  
- Students can request deletion of their biometric data  
- No continuous tracking outside of classroom boundaries  
- Instructor oversight ensures fairness and accountability  

---

## Key Innovation

This system combines two verification layers:

- **Geofencing (location validation)**  
- **Facial recognition (identity validation)**  

This dual-validation approach improves attendance accuracy while maintaining privacy and minimizing misuse.

---

## Documentation

All design artifacts, diagrams, and prototypes are stored in:

/docs/sprint2/

---

## Team

- **Sorel** – Backend Engineer  
- **Andrew** – Instructor Interface, Ethics & QA  
- **Andres** – Mobile Application & Geofence Engineer  
- **Shayan** – Biometric Recognition & Edge Processing Engineer  

---

## Disclaimer

This system is a prototype developed for academic purposes. It is not intended for production deployment without further security, compliance, and institutional integration.
