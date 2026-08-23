# Testing

This directory contains testing documentation for the UNT Biometric Attendance Prototype.

Testing is perfomed across the major components of the system, including geofence validation, backend API functionality, biometric verification, the mobile application, and full attendance check-in workflows.

## Testing Structure

- `test-case.md` - Defines test cases, expected behavior, and testing procedures.
- `test-result.md` - Records the results of completed test cases and identified issues.
- `screenshots/` - Contains supporting screenshots or other evidence when applicable.

## Areas Tested

### Geofence Validation

Tests verify that the application correctly determines whether a student's device is inside or outside the instructor-defined classroom boundry.

Testing includes:

- Location inside the permitted geofence
- Location outside the permitted geofence
- GPS accuracy validation
- Tile38 geofecne validation
- Boundry conditions near the configured radius

### Backend API 

Test verify communication between the mobile application and FastAPI backend.

Test includes:

- Valid check-in requests
- Invalid or incomplete requests
- Geofence validation responses
- Backend error handling
- Communication with Tile38

### Biometric Verification

Test verify the facial recognition portion of the attendance workflow.

Test include:

- Successful face recognition
- Non-matching face
- Camera permission handling
- Biometric verification integration with check-in

### Mobile Applicatoin 

Test verify functionality of the React Native/Expo application.

Test include:

- Location permissions
- Camera permissions
- Check-in interface
- Backend connectivity
- User feedback for successful and unsuccessful check-ins

### Integration testing 

Integration testing verifies the complete attendance workflow:

1. Student initiates check-in.
2. Decive obtains the students current location.
3. Location is submitted to the FastAPI backend.
4. The backend validates the location using the geofence service.
5. Biometric verification confirms student identity.
6. Attendance status is returned to the application.

## Test Environment

Testing may be performed using:

- React Native / Expo
- FastAPI
- Tile38
- Physical mobile devices
- Web browser
- Local development server

## Test documentation 

Detailed test procedures are available in:

- [Test Cases](./test-cases.md)
- [Test Results](./test-results.md)

Testing documentation will be updated throughout development as additioanl features are implemented and validatted.