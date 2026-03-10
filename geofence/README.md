# Geofence Prototype v0.1

This repository contains a simple proof-of-concept geofence attendance prototype.

The goal of this prototype is to demonstrate that a mobile app can:

- get a student's current location
- compare that location to a predefined geofence
- allow check-in only when the student is inside the allowed radius
- send the attendance attempt to a Python backend for server-side validation

This is only the geofence portion of the larger capstone project.

## Files

- `App.js` — mobile app interface and geofence check
- `main.py` — FastAPI backend with session and check-in endpoints

## Features in v0.1

- configurable geofence center and radius
- mobile location retrieval
- distance calculation using latitude/longitude
- server-side geofence validation
- simple attendance check-in logging

## Requirements

- Python 3.10+
- Node.js 20+
- npm

## Install and Run

### Backend

Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate

```

## Backend Dependency

The `requirements.txt` lists all the `Python` packages needed to run the backend

Install dependencies using:

`pip install -r requirements.txt`

Start the backend:

`uvicorn main:app --reload --host 0.0.0.0 --port 8000`

Backend docs:

`http://localhost:8000/docs`

### Frontend

Install dependencies:

`npm install`

Start Expo:

`npx expo start`

Testing

1. Start the backend
2. Start the Expo app
3. Allow location permissions
4. Usr the backend `/sessions` endpoint to set the geofence center and radius
5. Refresh location in the app
6. Attempt check-in
7. Verify results in `/checkins`


## Main Files

`main.py` -- FastAPI backend
`geofence-poc/` -- Expo React Native mobile app

---

```bash

This is an early proof of concept intended only to validate geofence behavior before integrating it into the larger capstone project.

```
