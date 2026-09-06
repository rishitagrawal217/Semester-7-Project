from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from datetime import datetime
from ml_service.database.session import Base
import pytz

class DetectionLog(Base):
    __tablename__ = "detection_logs"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, index=True)
    is_phishing = Column(Boolean)
    confidence = Column(Float)
    message = Column(String)
    timestamp = Column(DateTime, default=lambda: datetime.now(pytz.timezone('Asia/Kolkata')))


class QRDetectionLog(Base):
    """Separate table for QR-code checks, kept apart from DetectionLog
    (URL Checker) so QR history/metrics never mix with plain URL checks."""
    __tablename__ = "qr_detection_logs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    decoded_url = Column(String, nullable=True)
    qr_readable = Column(Boolean)
    is_phishing = Column(Boolean, nullable=True)
    confidence = Column(Float, nullable=True)
    message = Column(String)
    timestamp = Column(DateTime, default=lambda: datetime.now(pytz.timezone('Asia/Kolkata')))