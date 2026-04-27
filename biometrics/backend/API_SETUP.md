# 🎯 Biometric Backend API - Setup & Usage Guide

## 📁 Database Location

**Central Database:** `unt-biometric-attendance-prototype/data/enrollment_database.pkl`

This location is accessible to the **entire application** (backend, frontend, mobile, etc.)

---

## 🚀 Quick Start

### 1. **Start the API Server**

```bash
cd biometrics/backend
python api_server.py
```

You should see:

```
============================================================
🚀 Biometric Attendance Backend API Starting
📁 Database location: .../data/enrollment_database.pkl
👥 Enrolled users: 0
============================================================

API Documentation: http://localhost:8000/docs
============================================================
```

### 2. **Open in Browser**

Visit: **http://localhost:8000/docs**

This opens the **interactive API documentation** (Swagger UI) where you can:

- View all available endpoints
- Test enrollment and verification
- Check database status
- View logs

---

## 📋 API Endpoints

### Health & Status

- `GET /` - API info
- `GET /health` - Health check
- `GET /database/status` - Database status & user list

### Enrollment

- `POST /enroll` - Enroll new user with embedding
- `GET /users` - List enrolled users
- `DELETE /users/{username}` - Delete a user

### Verification

- `POST /verify` - Verify face embedding
- `GET /logs` - Get verification logs

### Database Management

- `POST /clear-database` - Clear all users (WARNING!)

---

## 🎓 Usage Examples

### Example 1: Check Database Status

```bash
curl http://localhost:8000/database/status
```

Response:

```json
{
  "total_users": 2,
  "users": ["john_doe", "jane_smith"],
  "database_file": "C:/path/to/data/enrollment_database.pkl",
  "database_dir": "C:/path/to/data"
}
```

### Example 2: Enroll a User

```bash
curl -X POST http://localhost:8000/enroll \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "embedding": [0.1, 0.2, ..., 0.5]
  }'
```

### Example 3: Verify Face

```bash
curl -X POST http://localhost:8000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "embedding": [0.15, 0.22, ..., 0.51],
    "threshold": 0.75
  }'
```

---

## 🎬 Run Verification Pipeline with API

```bash
cd biometrics/backend
python main_pipeline_api.py
```

This uses the centralized API backend instead of local database files.

---

## 🗄️ Database File Format

The `enrollment_database.pkl` contains:

```python
{
  "username_1": [512 floating point numbers],  # Face embedding
  "username_2": [512 floating point numbers],
  ...
}
```

---

## 📡 Accessing from Other Components

### From Frontend (React)

```javascript
const response = await fetch("http://localhost:8000/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    embedding: faceEmbedding,
    threshold: 0.75,
  }),
});
```

### From Mobile App

Same REST API - just update the URL to your server's IP:

```
http://192.168.x.x:8000/verify
```

### From Python

```python
import requests

response = requests.post('http://localhost:8000/verify',
  json={'embedding': embedding, 'threshold': 0.75}
)
result = response.json()
```

---

## ⚙️ Configuration

**API Server Settings** (in `api_server.py`):

- `HOST`: `0.0.0.0` (accessible from any IP)
- `PORT`: `8000`
- CORS enabled for:
  - `http://localhost:3000` (React frontend)
  - `http://localhost:8081` (Mobile app)
  - `*` (Any origin in development)

**Database Location:**

- Default: `../../data/enrollment_database.pkl` (relative to backend folder)
- Modify `DATABASE_FILE` in `api_server.py` to change location

---

## 🔒 Production Notes

For production deployment:

1. Change CORS `allow_origins` to specific domains only
2. Add authentication/authorization
3. Use HTTPS instead of HTTP
4. Deploy with production ASGI server (Gunicorn + Uvicorn)
5. Set up database backups
6. Add rate limiting and request validation

---

## 🐛 Troubleshooting

### "Cannot connect to API"

- Ensure API server is running: `python api_server.py`
- Check if port 8000 is available: `netstat -an | grep 8000`
- Try: `http://127.0.0.1:8000` instead of `localhost`

### "Database file not found"

- API automatically creates `/data` directory
- Check permissions in your project root
- Ensure you have write access to the `data` folder

### "Enrollment/Verification fails"

- Verify embedding is 512-dimensional
- Check threshold is between 0 and 1
- Inspect logs at `GET /logs` endpoint

---

## 📚 Related Files

- **API Server:** `biometrics/backend/api_server.py`
- **Enrollment Script:** `biometrics/backend/enrollment_script.py`
- **Verification Pipeline (API):** `biometrics/backend/main_pipeline_api.py`
- **Database:** `data/enrollment_database.pkl`
- **Logs:** `data/verification_log.json`
