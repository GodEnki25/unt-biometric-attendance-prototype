# Test Cases

## Tile38 Geofence Validation

- Tester: Andres Moreira (aom0065)
- Date: 24-08-2026
- Component: Geofence / Tile38

### TC-GEO-01: Tile38 Connection
- Start the Tile38 Docker container.
- Connect through the Python backend service.
- Execute a geofence lookup.

Expected result:
- Python successfully communicates with Tile38.

### TC-GEO-02: Inside Geofence
- Store a classroom geofence center in Tile38.
- Query the same coordinates using a 75 meter radius.

Expected result:
- Tile38 returns the session ID.
- Backend evaluates the device inside the geofence.

### TC-GEO-03: Outside Geofence
- Store a classroom geofence center in Tile38.
- Query coordinates located outside the 75 meter radius.

Expected result:
- Tile38 does not return the seesion ID.
- Backend evaluates the device as outside the geofence.

---

## Tile 38 Student Geofence Integration

- Tester: Andres Moreira (aom0065)
- Date: 31-08-2026
- Component: Student Check-In / Tile38

### TC-GEO-04 - Student outside geofence

- Open the student Check In screen.
- Allow the application to retrieve the device location.
- Send the location to the backend `/geofence/check` endpoint.
- Use coordinates outside the active classroom geofence.

Expected result:
- Tile38 does not return the session ID.
- Backend returns `inside: false`.
- Backend returns `allow_biometric: false`.
- Student application displays `OUTSIDE GEOFENCE`.
- Face Scan button remains disabled.

### TC-GEO-05: Student Inside Geofence

- Open the student Check In screen.
- Allow the application to retrieve the device location.
- Send the location to the backend `/geofence/check` endpoint.
- Use coordinates inside the active classroom geofence.

Expected result:
- Tile38 returns the session ID.
- Backend returns `inside: true`.
- Backend returns `allow_biometric: true`.
- Student application displays `INSIDE GEOFENCE`.
- Face Scan button becimes enabled.

### TC-GEO-06: Geofence API Registration

- Start the FastAPI backend.
- Open the FastAPI Swaagger documentation.
- Verify the geofence routes are registered.

Expected result:

- `GET /geofence/session` is available.
- `POST /geofence/check` is available.
- Geofence routes appear under the `geofence` section.


---