from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..services.ml_inference import predict_url
from ..services.qr_logging_service import log_qr_detection
from ..utils.qr_decoder import decode_qr, extract_url
from .detection import FeatureExplanation

router = APIRouter(prefix="/api", tags=["qr"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB


class QRPredictionResponse(BaseModel):
    filename: str
    qr_readable: bool
    decoded_url: Optional[str] = None
    is_phishing: Optional[bool] = None
    confidence: Optional[float] = None
    message: str
    explanation: list[FeatureExplanation] = []


@router.post("/predict/qr", response_model=QRPredictionResponse)
async def predict_qr_endpoint(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large (max 5MB).")

    decoded_text = decode_qr(image_bytes)
    decoded_url = extract_url(decoded_text) if decoded_text else None

    if decoded_url is None:
        message = (
            "No QR code detected in this image."
            if decoded_text is None
            else "The QR code doesn't contain a URL."
        )
        log_qr_detection(
            filename=file.filename,
            decoded_url=None,
            qr_readable=decoded_text is not None,
            is_phishing=None,
            confidence=None,
            message=message,
        )
        return {
            "filename": file.filename,
            "qr_readable": decoded_text is not None,
            "decoded_url": None,
            "is_phishing": None,
            "confidence": None,
            "message": message,
            "explanation": [],
        }

    result = predict_url(decoded_url, explain=True)
    message = "Phishing detected!" if result["is_phishing"] else "Looks safe."

    log_qr_detection(
        filename=file.filename,
        decoded_url=decoded_url,
        qr_readable=True,
        is_phishing=result["is_phishing"],
        confidence=result["confidence"],
        message=message,
    )

    return {
        "filename": file.filename,
        "qr_readable": True,
        "decoded_url": decoded_url,
        "is_phishing": result["is_phishing"],
        "confidence": result["confidence"],
        "message": message,
        "explanation": result["explanation"],
    }
