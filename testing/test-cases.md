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