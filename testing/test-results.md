# Test Results

## Tile38 Geofence Validation Results

- Tester: Andres
- Date: 2026-08-24
- Component: Geofence / Tile38

### TC-GEO-01
Result: PASS

The python backend successfully connected to the Tile38 Docker container using the Redis RESP protocol.

### TC-GEO-02
Result: PASS

Tile38 returned the stored session ID when the test coordinates were inside the configured radius.

### TC-GEO-03
Result: PASS

Tile38 did not return the stored session ID when the test coordinates were outside the configured radius.

--- 

- Date: 31-08-2026
- Comonent: Geofence / Tile38

### TC-GEO-04
Result: PASS

The student appication sent the decive location to the FastAPI `/geofence/check` endpoint.

Tile38 evaluated the location outside the active geofence.

The application displayed `OUTSIDE GEOFENCE` and the Face Scan button remained disabled.

### TC-GEO-05
Result: PASS

The student appication sent the decive location to the FastAPI `/geofence/check` endpoint.

Tile38 evaluated the location inside the active geofence.

The application displayed `INSIDE GEOFENCE` and the Face Scan button became endabled.

### TC-GEO-06
Result: PASS

The FastAPI backend successuffly registered the geofence routes.

`GET /geofence/session` and `POST /geofence/check` were available through the FastAPI Swagger doumentation.

---