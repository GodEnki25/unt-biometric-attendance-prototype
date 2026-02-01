# UNT Biometric Attendance Prototype

This project explores an edge-based classroom presence verification system that applies biometric recognition to assist instructors with attendance management. The system is designed to operate entirely within a local execution environment and integrates with Canvas as the authoritative record for attendance data.

Rather than functioning as a surveillance or enforcement mechanism, the system is intentionally designed as a decision-support tool that reduces routine instructor workload while preserving transparency, consent, and human oversight.

---

## Design Philosophy

- Edge-first biometric processing (no cloud inference or uploads)
- Explicit, revocable student participation
- Instructor retains final authority over attendance records
- Presence verification instead of continuous monitoring
- Privacy-conscious handling of biometric data

---

## Core Capabilities

- Event-driven classroom presence detection
- Timestamped arrival classification (on-time vs delayed)
- Instructor review and override interface
- Programmatic attendance record submission to Canvas
- Local-only biometric processing and transient data use

---

## Planned Architecture

- **/frontend**  
  Instructor-facing web interface for attendance review and adjustments

- **/backend**  
  Local API services, data coordination, and Canvas integration logic

- **/ml**  
  Biometric recognition pipeline executed on local hardware

- **/docs**  
  Project charter, system vision, and design documentation

---

## Execution Model

All biometric processing is performed on an on-premise device or local server. Facial imagery is not transmitted to third-party services, and biometric representations are not persistently stored. Canvas is treated as the system of record for finalized attendance data.

---

## Project Status

Sprint 0 – Planning, architecture definition, and SDLC setup
