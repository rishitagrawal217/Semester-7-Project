from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from .database.session import init_db
from .routers.detection import router as detection_router
from .routers.admin import router as admin_router
from .routers.auth import router as auth_router
from .routers.qr import router as qr_router

load_dotenv()

app = FastAPI(title="Phishing URL Detector")

# CORS — allow the React frontend (dev + deployed) to call this API from the browser.
# Override in production via ALLOWED_ORIGINS env var (comma-separated list).
_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

@app.get("/")
def home():
    return {"status": "ML Service is running", "env_example": os.getenv("APP_NAME", "Not set")}

@app.get("/health")
def health():
    return {"status": "healthy"}

app.include_router(auth_router)
app.include_router(detection_router)
app.include_router(admin_router)
app.include_router(qr_router)