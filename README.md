# UNT Biometric Attendance Prototype

This project implements a mobile-based classroom presence verification system that combines facial recognition and geofencing to assist instructors with attendance management. The system is designed as an academic prototype and operates independently of the Canvas database while maintaining a Canvas-aligned attendance model.

Attendance verification occurs only when a student’s device enters a predefined classroom boundary. Facial recognition is used as a confirmation step rather than a continuous monitoring mechanism. Instructors retain full authority to manually adjust or override attendance records.

---

## Design Principles

- Mobile-first implementation using device location and camera capabilities
- Classroom geofence validation during attendance check-in  
- Facial recognition used as an identity-verification step
- No direct access to Canvas databases  
- Instructor-controlled attendance authority
- Separation of location validation and biometric verification 
- Privacy-conscious handling of location and biometric information  

---

## Core Capabilities

- Student attendance check-in through a mobile application
- Instructor-defined classroom geofences
- Geospatial validation using Tile38
- Facial recognition for identity verification
- FastAPI backend for application services
- Local attendance data storage
- Instructor-facing attendance functionality
- Location and camera permission handling
- Attendance workflow validation and error handling

---

## System Components

### `/backend` 

FastAPI backend containing API routes, database functionality, application services, geofence integration, and attendance logic.

### `/biometrics` 

Biometric and facial-recognition functionality used for student identity verification.

### `/react_demo/reactDemo` 

React Native / Expo frontend containing the student and instructor application interfaces.

### `/docs` 

Project documentation, design artifacts, architecture information, and supporting Capstone documentation.

### `/testing`

Testing documentation including defined test cases, test results, and supporting evidence.

### `CONTRIBUTIONS.md`

Tracks major features, modules, documentation, and other work contributed by each team member throughout the project.

---

## Execution Model

The system does not connect directly to Canvas databases. Attendance records are stored locally and structured to mirror Canvas attendance formats. This allows realistic demonstration without requiring institutional API permissions.

Location services are used only for attendance-related classroom boundary detection. During an active class session, the system may monitor geofence entry and exit events to determine whether a checked-in student remains within the classroom boundary. Location monitoring ends with the active attendance session and is not performed outside the classroom attendance context..

---

## Attendance Verification Workflow

1. A student initiates attendance check-in.
2. The mobile application requests the student's current location.
3. The location is submitted to the FastAPI backend.
4. The backend validates the location against the configured classroom geofence.
5. If location validation succeeds, biometric verification is performed.
6. The attendance result is recorded and returned to the application.

> Location information is used for attendance verification and is not intended for continuous location monitoring outside the attendance workflow.

---

# Project Progress

## Capstone I

### Sprint 0 – Initiation

- Created and initialized the project GitHub repository
- Created and configured the Trello board for project management
- Defined initial team roles and responsibilities
- Selected the Software Development Life Cycle (SDLC) model
- Drafted the Project Charter
- Identified project stakeholders
- Established the initial project structure and development direction

### Sprint 1 – Requirements & Planning

- Developed system requirements and Software Requirements Specification (SRS) 
- Created User Stories for major system roles:
  - Instructor  
  - Student  
  - Admin

- Defined the mobile attendance check-in workflow
- Established project requirements, constraints, and development responsibilities
- Planned the major system components required for the prototype

### Sprint 2 – System Design

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

### Sprint 3 - MVP Development

- Developed the project's Minimum Viable Product (MVP)
- Implemented the initial functional application prototype
- Combined the major system concepts into a working demonstration
- Developed initial backend functionality
- Integrated early geofence and biometric functionality
- Prepared the MVP for demonstration and evaluation

### Sprint 4 - System Integration & Final Development

- Continued backend API integration
- Continued facial recognition integration
- Validated geofence functionality
- Developed initial instructor dashboard
- Performed end-to-end system testing
- Integrated the major application components
- Prepared the prototype for Capstone I final demonstration

---

## Capstone II -- Current Development

Capstone II focuses on expanding the Capstone I prototype into a more complete attendance verification system. Current development includes improvements to geofence validation, real-time attendance monitoring, backend integration, biometric verification, testing, and instructor-facing functionality.

### Real-Time Attendance Tracking

A new real-time attendance component is being developed to extend attendance verification beyond the initial student check-in.

Planned functionality includes:

- Monitoring whether a checked-in student remains within the defined classroom boundary during an active class session
- Recording timestamps when a student leaves the classroom boundary
- Detecting when a student re-enters the classroom boundary
- Providing instructors with updated attendance and presence information
- Supporting instructors review of attendance status during a class session
- Expanding backend and database functionality to support real-time attendance events and state changes
- Testing location accuracy, boundary detection, timestamps, network behavior, and attendance state transitions

This change is intended to reduce cases where a student completes the initial attendance check-in and then leaves before the class session is complete.

### Tile38 Geofence Integration

The original prototype used application-level distance calculations for geofence validation. Capstone II development is transitioning geospatial validation to Tile38.

Current Tile38 work includes:

- Storing instructor-defined classroom geofences
- Validating student coordinates against classroom boundaries
- Integrating Tile38 queries with the FastAPI backend
- Connecting Tile38 validation results to the mobile attendance workflow
- Testing inside/outside boundary conditions
- Handling GPS accuracy and boundary-edge cases
- Supporting the geospatial requirements of real-time attendance tracking

Tile38 provides a dedicated geospatial engine for location validation while allowing the application backend to control when and why location checks occur.

### Backend & Database Integration

Backend development is being expanded to support the new Capstone II functionality.

Current work includes:

- Integrating geofence services with FastAPI
- Supporting attendance check-in and validation requests
- Expanding attendance records to support real-time status updates
- Recording attendance-related timestamps and state changes
- Connecting mobile and instructor-facing functionality to backend services
- Maintaining separation between geospatial validation, biometric verification, and attendance records

### Biometric Verification Integration

Biometric verification continues to serve as the identity-validation component of the attendance workflow.

Current development includes:

- Integrating facial recognition with the complete attendance workflow
- Connecting biometric results with backend attendance services
- Validating student identity after location requirements are satisfied
- Testing biometric verification as part of end-to-end attendance scenarios

### Instructor Functionality

Instructor-facing functionality is being expanded to support the updated attendance model.

Current development includes:

- Viewing student attendance information
- Reviewing student presence status
- Supporting attendance corrections and instructor overrides
- Displaying information associated with attendance state changes
- Integrating instructor functionality with backend attendance services

### Testing & Validation

Capstone II includes expanded testing of individual components and the complete attendance workflow.

Testing includes:

- Geofence boundary validation
- Tile38 geospatial queries
- Backend API functionality
- Biometric verification
- Mobile location and camera permissions
- Frontend/backend communication
- Real-time attendance state transitions
- Student boundary exit and re-entry scenarios
- Timestamp validation
- End-to-end attendance workflows

Testing documentation and results are maintained in the [`/testing`](./testing) directory.

Individual development contributions are documented in [`CONTRIBUTIONS.md`](./CONTRIBUTIONS.md).

---

## Technologies Used

-   React Native
-   Expo
-   TypeScript
-   Python
-   FastAPI
-   SQLite
-   Tile38
-   Docker
-   OpenCV / biometric recognition tooling
-   Git / GitHub

---

# Development Setup

## Backend Setup

From the project root:

``` bash
cd backend
python3 -m venv .venv
```

### Activate the Virtual Environment

#### Windows

``` bash
.venv\\Scripts\\activate
```

#### WSL / Linux / macOS

``` bash
source .venv/bin/activate
```

Install backend dependencies:

``` bash
pip install -r requirements.txt
```

## Frontend Setup

``` bash
cd react_demo/reactDemo
npm install
```

## One-Command Development Startup

From the project root:

``` bash
npm install
npm run dev
```

> This starts the development services used by the project, including the FastAPI backend and Expo frontend.

---

## Key Innovation

This system combines two verification layers:

- **Geofencing (location validation)**  
- **Facial recognition (identity validation)**  

This dual-validation approach improves attendance accuracy while maintaining privacy and minimizing misuse.

---

## Physical Device Testing

When testing with Expo Go on a physical device, the device must be able
to reach the computer running the backend.

``` ts
const API_BASE =
  Platform.OS === "web"
    ? "http://127.0.0.1:8000"
    : "http://YOUR-DESKTOP-IP:8000";
```

- Use the development computer's LAN IP address.
- Do not use `localhost` or `127.0.0.1` as the mobile backend address.
- The mobile device and development computer must be able to communicate over the network.
- The backend must be running before check-in requests can succeed.
-   Camera and location permissions must be granted.

---

# Testing

Testing documentation is maintained in the [`/testing`](./testing)
directory.

Testing covers:

-   Geofence boundary validation
-   Tile38 geospatial validation
-   Backend API functionality
-   Biometric verification
-   Location and camera permissions
-   Frontend/backend communication
-   Complete attendance check-in workflows

Defined procedures are documented in:

-   [`testing/test-cases.md`](./testing/test-cases.md)
-   [`testing/test-results.md`](./testing/test-results.md)

> Testing documentation is updated as functionality is implemented and validated.

---

# Privacy & Ethics

- Location services are used only for attendance-related geofence validation.
- Location monitoring is limited to active attendance sessions.
- Geofence entry and exit events may be recorded during an active class session.
- The system does not track a student's location outside active class sessions.
- Facial recognition is performed only as part of attendance verification.
- Biometric verification and geofence validation are handled as separate verification components.
- Instructors retain authority over attendance records and corrections.
- Biometric and location functionality is limited to the purposes of the academic attendance prototype.

---

# Documentation

Additional project documentation and design artifacts are maintained in
`/docs`.

Individual team contributions are documented in
[`CONTRIBUTIONS.md`](./CONTRIBUTIONS.md).

---

## Demo Notes

For presentation day:

  1. Run `npm run dev`
  2. Open Expo Go on mobile device
  3. Allow Camera permissions
  4. Allow Location permissions
  5. Verify geofence before biometric check-in

---

# Team

-   **Sorel Agbogla** -- Team Lead / Backend & Database
-   **Andrew Kim** -- UI/UX / Instructor Interface
-   **Andres Moreira** -- Geofence / Backend Integration
-   **Shayan Karki** -- Biometric Recognition / Backend Integration

> See [`CONTRIBUTIONS.md`](./CONTRIBUTIONS.md) for detailed individual contributions. 

---

# Disclaimer

This system is an academic prototype developed as part of the University
of North Texas Capstone program. It is not intended for production
deployment without additional security, privacy, compliance,
scalability, and institutional review.
