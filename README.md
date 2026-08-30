# Phishing URL Detection

A FastAPI service that uses a trained Random Forest model to classify URLs as phishing or legitimate, based on lexical features extracted from the URL string (no external calls or page fetching required). Ships with a React + Tailwind frontend (its own container) and an optional hand-rolled forward proxy to block phishing sites live at the network level.

The detection **Logs** are admin-only, protected by a username/password login (JWT) enforced on the API itself — see [Admin auth](#5-admin-auth-username--password) and [frontend/README.md](frontend/README.md).

## Architecture

```
┌─────────────────┐      POST /api/predict      ┌──────────────────┐
│  Client / curl / │ ───────────────────────────▶│   FastAPI app     │
│  Proxy addon     │◀─────────────────────────── │  (ml_service)     │
└─────────────────┘        JSON response         └────────┬─────────┘
                                                            │
                                            extract_features(url)
                                                            │
                                                            ▼
                                                  RandomForest model
                                              (models/phishing_model_rf_2.joblib)
                                                            │
                                                            ▼
                                                  SQLite log (phishing_logs.db)
```

- **`ml_service/main.py`** — FastAPI app entrypoint, mounts routers, initializes the DB.
- **`ml_service/routers/detection.py`** — `POST /api/predict` endpoint.
- **`ml_service/routers/admin.py`** — `GET /api/logs` (admin-only), `GET /api/metrics` (public).
- **`ml_service/routers/auth.py`** — `POST /api/login` (issues a JWT for valid admin credentials).
- **`ml_service/services/auth.py`** — checks credentials, mints/verifies JWTs, and gates `/api/logs`.
- **`ml_service/services/ml_inference.py`** — loads the `.joblib` model and runs predictions.
- **`frontend/`** — React + Tailwind SPA (own Docker container, served by nginx). See [frontend/README.md](frontend/README.md).
- **`ml_service/utils/feature_extractor.py`** — turns a raw URL string into ~30 lexical features (length, dot count, IP-in-host, `https` token, shortening services, etc.).
- **`ml_service/database/session.py`** — SQLAlchemy engine/session pointed at a local SQLite file.
- **`models/`** — pretrained `.joblib` model files.
- **`proxy/server.py`** — a standalone forward proxy (raw sockets, no mitmproxy) that intercepts browser traffic and blocks any request whose URL the model flags as phishing.
- **`train_model.py` / `train_model_url_only.py`** — scripts to retrain the model from `data/dataset_phishing.csv`.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose) — this is the only requirement for running the API.
- *(Optional, for the live proxy only)* Python 3.9+ locally, to run `proxy/server.py`.

## 1. Clone & Start the Service

```bash
git clone https://github.com/Advay-2306/Phishing-URL-Detection
cd Phishing-URL-Detection
docker compose up --build -d
```

This builds the images and starts two containers:

| Service       | Purpose                                   | URL / Port |
|---------------|--------------------------------------------|------|
| `frontend`    | React + Tailwind SPA (nginx)               | http://localhost:8080 |
| `ml-service`  | The FastAPI app (SQLite lives on disk here via its own bind mount) | http://localhost:8000 |

> The frontend publishes host port **8080** (host `:3000` is commonly taken). Change it in `docker-compose.yml` if you like — then update `ALLOWED_ORIGINS` to match.

First build takes a few minutes (installing scikit-learn, pandas, and building the frontend). Subsequent starts are fast.

Check it's running:

```bash
docker compose ps
```

You should see `frontend-1` and `ml-service-1` as `Up`. Open the app at **http://localhost:8080**.

### Configuration (`.env`)

Copy `.env.example` to `.env` and fill it in. Key variables:

| Variable | Used by | Purpose |
|----------|---------|---------|
| `ADMIN_USERNAME` | backend | Admin login name for the Logs page. |
| `ADMIN_PASSWORD` | backend | Admin password (**change this**). |
| `JWT_SECRET` | backend | Secret that signs session tokens (**change this**). |
| `JWT_EXPIRE_HOURS` | backend | Session lifetime in hours (default 12). |
| `VITE_API_BASE_URL` | frontend | Backend URL the browser calls (e.g. your Render URL). |
| `ALLOWED_ORIGINS` | backend | CORS allow-list; must include your frontend origin. |

Defaults are `admin` / `admin` so it works out of the box — **change them before deploying**. Generate a strong `JWT_SECRET` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## 2. Verify It's Alive

```bash
curl http://localhost:8000/
curl http://localhost:8000/health
```

Expected:
```json
{"status":"ML Service is running","env_example":"Not set"}
{"status":"healthy"}
```

## 3. Interactive API Docs (Swagger UI)

FastAPI auto-generates interactive docs — open in a browser:

```
http://localhost:8000/docs
```

You can try every endpoint from there directly, no curl needed.

## 4. Check a URL for Phishing

```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com"}'
```

Response:
```json
{
  "url": "https://www.google.com",
  "is_phishing": false,
  "confidence": 0.87,
  "message": "Looks safe."
}
```

Try a suspicious-looking one:
```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"url": "http://192.168.1.1-login-verify-account.tk/secure/update?user=1&id=2"}'
```
```json
{
  "url": "http://192.168.1.1-login-verify-account.tk/secure/update?user=1&id=2",
  "is_phishing": true,
  "confidence": 0.91,
  "message": "Phishing detected!"
}
```

Every prediction is automatically logged to a local SQLite database (`logs/phishing_logs.db` inside the container).

## 5. Admin Auth (Username + Password)

The detection **Logs** are admin-only. Access is enforced on the API, not just hidden in the UI:

```bash
curl "http://localhost:8000/api/logs?limit=10"          # → 401 Admin sign-in required
```

Log in from the frontend's **Logs** page (default `admin` / `admin`). Under the hood:

```bash
# Get a token
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
# → {"access_token":"<JWT>","token_type":"bearer","username":"admin"}

# Use it
curl "http://localhost:8000/api/logs?limit=10" -H "Authorization: Bearer <JWT>"   # → 200
```

Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `JWT_SECRET` in `.env` (see the config table above), then `docker compose up -d ml-service`. No external service or OAuth app needed.

`GET /api/metrics` stays **public** (powers the Dashboard):
```bash
curl http://localhost:8000/api/metrics
# {"total_checks": 2, "phishing_detected": 1, "detection_rate": 50.0}
```

## 6. (Optional) Live Traffic Blocking via Proxy

`proxy/server.py` is a small, self-contained forward proxy (plain Python sockets — no mitmproxy) that checks every browsed URL against the running API. It runs **outside** Docker, directly on your machine, since it needs to sit in front of your browser's traffic:

```bash
pip install httpx
python proxy/server.py
```

> Listens on `127.0.0.1:8081` — `8081` because the frontend container already occupies host `8080`.

Then point your browser's HTTP **and** HTTPS proxy settings to `127.0.0.1:8081`. Requests to `localhost`/`127.0.0.1` are always allowed through so the API itself doesn't get blocked.

**HTTP vs. HTTPS blocking differ**, since the proxy doesn't do TLS interception (no CA cert to generate or trust):
- **Plain HTTP** — the full URL (path + query) is visible, so a flagged URL gets a real 403 response with a custom "Blocked: Phishing URL Detected" warning page.
- **HTTPS** — only the hostname from the `CONNECT` request is visible without decrypting traffic. A flagged host has its `CONNECT` refused and the connection closed; the browser shows its own generic connection-failed error, not the custom warning page. Safe hosts get a raw, unmodified TCP tunnel.

If the prediction API itself is unreachable, the proxy fails open (lets the request through) rather than blocking all browsing.

## 7. Retraining the Model (Optional)

The repo ships two training scripts using `data/dataset_phishing.csv`:

```bash
python train_model.py            # full feature set
python train_model_url_only.py   # URL-lexical-features-only variant (matches feature_extractor.py)
```

These write a new `.joblib` file into `models/`. Update `ml_service/services/ml_inference.py`'s `model_path` if you rename the output file, then rebuild:
```bash
docker compose up --build -d
```

## 8. Stopping / Cleaning Up

```bash
docker compose stop        # stop containers, keep them for later
docker compose down        # stop and remove containers (keeps the image + volumes)
docker compose down --rmi local  # also remove the built image
```

## API Reference Summary

| Method | Path            | Access | Description                          |
|--------|-----------------|--------|---------------------------------------|
| GET    | `/`             | Public | Service status check                  |
| GET    | `/health`       | Public | Health check                          |
| POST   | `/api/login`    | Public | Exchange admin credentials for a JWT  |
| POST   | `/api/predict`  | Public | Classify a URL, logs the result       |
| GET    | `/api/logs`     | **Admin** | List recent detection logs (`?limit=`) — requires admin JWT |
| GET    | `/api/metrics`  | Public | Aggregate detection statistics        |
| GET    | `/docs`         | Public | Swagger UI                            |
| GET    | `/openapi.json` | Public | Raw OpenAPI schema                    |

## Troubleshooting

- **Port 8000 / 8080 already in use** — change the host port in `docker-compose.yml` (`"8001:8000"` or `"8090:80"`). Update `ALLOWED_ORIGINS` if you move the frontend.
- **`docker compose up` fails on build** — make sure Docker Desktop is running (`docker info` should succeed).
- **Can't log in / "Invalid username or password"** — check `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` and restart `ml-service` (`docker compose up -d ml-service`).
- **Logged in but logs won't load / keep getting logged out** — your session JWT expired (default 12h) or `JWT_SECRET` changed; just log in again.
- **CORS errors in console** — add your frontend origin (e.g. `http://localhost:8080`) to `ALLOWED_ORIGINS` and restart `ml-service`.
- **Model not found / fallback response** (`confidence: 0.5` always) — confirm `models/phishing_model_rf_2.joblib` exists; it's expected to ship with the repo.
- **Logs/metrics empty** — you need to hit `/api/predict` at least once first; the SQLite DB is created on first write.
