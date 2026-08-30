from fastapi import APIRouter
from pydantic import BaseModel
from ..services.ml_inference import predict_url
from ..services.logging_service import log_detection

router = APIRouter(prefix="/api", tags=["detection"])


class URLRequest(BaseModel):
    url: str
    # Runs a SHAP explanation alongside the prediction (~0.7s extra). Only the
    # web UI's URL Checker should set this - the proxy calls this same
    # endpoint on every browsed request and must stay fast, so it always
    # leaves this at the default.
    explain: bool = False


class FeatureExplanation(BaseModel):
    feature: str
    label: str
    detail: str
    value: float
    contribution: float
    direction: str


class PredictionResponse(BaseModel):
    url: str
    is_phishing: bool
    confidence: float
    message: str
    explanation: list[FeatureExplanation] = []


@router.post("/predict", response_model=PredictionResponse)
def predict_url_endpoint(request: URLRequest):
    result = predict_url(request.url, explain=request.explain)

    # Log to database
    log_detection(
        url=request.url,
        is_phishing=result["is_phishing"],
        confidence=result["confidence"],
        message="Phishing detected!" if result["is_phishing"] else "Looks safe."
    )

    return {
        "url": request.url,
        "is_phishing": result["is_phishing"],
        "confidence": result["confidence"],
        "message": "Phishing detected!" if result["is_phishing"] else "Looks safe.",
        "explanation": result["explanation"],
    }