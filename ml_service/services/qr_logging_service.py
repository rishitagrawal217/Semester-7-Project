from ..database.session import SessionLocal
from models.sqlalchemy_models import QRDetectionLog
from datetime import datetime
import pytz


def log_qr_detection(filename, decoded_url, qr_readable, is_phishing, confidence, message):
    db = SessionLocal()
    try:
        log_entry = QRDetectionLog(
            filename=filename,
            decoded_url=decoded_url,
            qr_readable=qr_readable,
            is_phishing=is_phishing,
            confidence=confidence,
            message=message,
            timestamp=datetime.now(pytz.timezone('Asia/Kolkata'))
        )
        db.add(log_entry)
        db.commit()
    finally:
        db.close()
