from fastapi import APIRouter, Depends
from ..database.session import SessionLocal
from ..services.auth import require_admin
from models.sqlalchemy_models import DetectionLog, QRDetectionLog
from datetime import datetime
import pytz

router = APIRouter(prefix="/api", tags=["admin"])


def _localize(rows):
    for row in rows:
        if row.timestamp:
            row.timestamp = row.timestamp.replace(tzinfo=pytz.utc).astimezone(pytz.timezone('Asia/Kolkata'))
    return rows


@router.get("/logs")
def get_logs(limit: int = 50, admin: dict = Depends(require_admin)):
    db = SessionLocal()
    logs = db.query(DetectionLog).order_by(DetectionLog.timestamp.desc()).limit(limit).all()
    db.close()
    return _localize(logs)


@router.get("/metrics")
def get_metrics(admin: dict = Depends(require_admin)):
    db = SessionLocal()
    total = db.query(DetectionLog).count()
    phishing_count = db.query(DetectionLog).filter(DetectionLog.is_phishing == True).count()
    db.close()
    return {
        "total_checks": total,
        "phishing_detected": phishing_count,
        "detection_rate": round(phishing_count / total * 100, 2) if total > 0 else 0
    }


@router.get("/qr/logs")
def get_qr_logs(limit: int = 50, admin: dict = Depends(require_admin)):
    db = SessionLocal()
    logs = db.query(QRDetectionLog).order_by(QRDetectionLog.timestamp.desc()).limit(limit).all()
    db.close()
    return _localize(logs)


@router.get("/qr/metrics")
def get_qr_metrics(admin: dict = Depends(require_admin)):
    db = SessionLocal()
    total = db.query(QRDetectionLog).count()
    unreadable = db.query(QRDetectionLog).filter(QRDetectionLog.qr_readable == False).count()
    readable = total - unreadable
    phishing_count = db.query(QRDetectionLog).filter(QRDetectionLog.is_phishing == True).count()
    db.close()
    return {
        "total_checks": total,
        "unreadable_count": unreadable,
        "readable_rate": round(readable / total * 100, 2) if total > 0 else 0,
        "phishing_detected": phishing_count,
        "detection_rate": round(phishing_count / readable * 100, 2) if readable > 0 else 0,
    }
