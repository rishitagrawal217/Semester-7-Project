# Phishing Detector — Frontend

A React (Vite) + Tailwind CSS single-page app that talks to the FastAPI backend in this repo. Four pages:

| Page          | Route         | Backend call                              | Access | What it does |
|---------------|---------------|--------------------------------------------|--------|--------------|
| URL Checker   | `/`           | `POST /api/predict`                        | Public | Type a URL → Safe/Phishing result with a confidence bar and a SHAP-based "Why?" breakdown of the top contributing features. |
| QR Checker    | `/qr-checker` | `POST /api/predict/qr`                     | Public | Upload/drag a QR code image → decodes it, shows the URL it points to, and runs the same result + "Why?" UI as the URL Checker. |
| Dashboard     | `/dashboard`  | `GET /api/metrics` / `GET /api/qr/metrics` | **Admin only** | Stat cards + donut chart, with a URL Checks / QR Codes tab (QR adds a "Readable Rate" stat and an Unreadable slice). |
| Logs          | `/logs`       | `GET /api/logs` / `GET /api/qr/logs`       | **Admin only** | Searchable, filterable table of every past check, same URL/QR tab split. |

Both `Dashboard` and `Logs` read from entirely separate data on the backend for each tab (separate DB tables, separate endpoints) — the tab just switches which one is displayed, it isn't a client-side filter over shared rows.

## Admin authentication (username + password + JWT)

The **Dashboard** and **Logs** pages (both tabs on each) are admin-only. Security is enforced in two places:

1. **Backend** — `POST /api/login` checks the credentials against env vars and returns a signed **JWT**. `GET /api/logs`, `GET /api/metrics`, `GET /api/qr/logs`, and `GET /api/qr/metrics` all require that token (`Authorization: Bearer …`); a direct `curl` without it is rejected with `401`. Hiding the page alone would not be secure.
2. **Frontend** — a shared `AuthGate` component (`src/components/AuthGate.jsx`) shows a login form on both pages until the admin signs in; the JWT is then stored and attached to every request via an axios interceptor.

The URL Checker and QR Checker stay fully public — anyone can check a URL or upload a QR code without logging in. Only the aggregate metrics/history views require admin auth. No external service, OAuth app, or client ID is required.

### Configure the credentials

Set these in the repo-root `.env` (used by docker-compose — see [../README.md](../README.md)):

```bash
# ../.env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me           # CHANGE THIS
JWT_SECRET=a-long-random-string    # CHANGE THIS — signs the session tokens
JWT_EXPIRE_HOURS=12                # session lifetime
```

Generate a strong secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Restart the backend after changing them: `docker compose up -d ml-service`.

## Run it — development

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:3000`, or the next free port). The backend must be running (`docker compose up -d` from the repo root).

> **CORS:** the backend only accepts browser requests from origins in its allow-list (`ALLOWED_ORIGINS`). Ports `8080`, `3000`, and `5173` (localhost + 127.0.0.1) are allowed by default. If Vite picks a different port, add that origin to `ALLOWED_ORIGINS` in the root `.env` and restart the backend.

## Run it — Docker (production-style)

The frontend has its own container (multi-stage: Vite build → nginx). From the repo root:

```bash
docker compose up --build -d
```

Served at **http://localhost:8080** (host `:3000` is often taken, so the frontend container publishes `8080`). Change the mapping in `docker-compose.yml` (`"8080:80"`) if you prefer another port — and add that origin to `ALLOWED_ORIGINS`.

## Point it at a different backend (e.g. Render)

`VITE_API_BASE_URL` controls the backend URL (baked at build time):

```bash
# root .env  (or frontend/.env for `npm run dev`)
VITE_API_BASE_URL=https://your-ml-service.onrender.com
```

Then rebuild. Also add your deployed frontend origin to the backend's `ALLOWED_ORIGINS`.

## Production build (static hosting, no container)

```bash
npm run build      # → dist/
npm run preview    # serve dist/ locally to check it
```

Deploy `dist/` to any static host (Netlify, Vercel, Render Static Site). Set `VITE_API_BASE_URL` in that host's build environment.

## Project structure

```
frontend/
├── Dockerfile              # multi-stage: node build → nginx serve
├── nginx.conf              # SPA fallback routing
├── vite.config.js          # React + Tailwind plugins, dev port 3000
├── .env                    # VITE_API_BASE_URL
├── public/shield.svg
└── src/
    ├── main.jsx            # entry: AuthProvider + Router
    ├── App.jsx             # layout + routes
    ├── api/client.js       # axios instance; attaches admin JWT to requests
    ├── auth/
    │   └── AuthContext.jsx # login/logout + JWT session state
    ├── components/
    │   ├── Navbar.jsx           # nav + signed-in admin badge / sign-out
    │   ├── StatCard.jsx
    │   ├── LoginForm.jsx        # username/password form
    │   ├── AuthGate.jsx         # shared "sign in to view this" wrapper (Dashboard + Logs)
    │   ├── SourceTabs.jsx       # shared URL Checks / QR Codes tab switcher
    │   └── PredictionResult.jsx # shared result card + SHAP "Why?" section (UrlChecker + QRChecker)
    └── pages/
        ├── UrlChecker.jsx
        ├── QRChecker.jsx   # drag/drop or click to upload a QR image
        ├── Dashboard.jsx   # admin-gated; URL Checks / QR Codes tab
        └── Logs.jsx        # admin-gated; URL Checks / QR Codes tab
```

## Notes

- All backend calls live in `src/api/client.js`. A request interceptor attaches the stored JWT as `Authorization: Bearer …` to every request; `/api/logs`, `/api/metrics`, `/api/qr/logs`, and `/api/qr/metrics` all require it, `/api/predict` and `/api/predict/qr` ignore it.
- If the token expires, the next admin-only call returns `401`; the app clears the session and shows the login form again — on Dashboard/Logs, that's every request, so an expired session kicks you straight back to `AuthGate`.
- `predictUrl(url, { explain: true })` is what the URL Checker's "Check" button calls — it's what triggers the SHAP explanation server-side (~0.7s slower than a plain check). `QRChecker`'s upload always requests it too, since it's the same kind of user-initiated, non-hot-path check.
- The Dashboard donut sets `isAnimationActive={false}` on purpose: Recharts' enter animation renders an empty chart under React 18 StrictMode's double-mount.
