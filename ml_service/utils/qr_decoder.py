from __future__ import annotations

import re

import cv2
import numpy as np

_detector = cv2.QRCodeDetector()
_URL_RE = re.compile(r"https?://\S+")


def decode_qr(image_bytes: bytes) -> str | None:
    """Decode a QR code from raw image bytes. Returns the raw decoded text,
    or None if no QR code could be found/read in the image."""
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_GRAYSCALE)
    if image is None:
        return None

    data, points, _ = _detector.detectAndDecode(image)
    if not data or points is None:
        return None
    return data


def extract_url(text: str) -> str | None:
    """Pull a URL out of decoded QR text. Handles payloads that aren't a
    clean URL string on their own (e.g. this project's QR dataset encodes
    the str() of a pandas Series row rather than the raw URL, so the
    payload looks like "72180    https://example.com/\\nName: url, dtype:
    object" - \\S+ naturally stops at the surrounding whitespace)."""
    if not text:
        return None
    match = _URL_RE.search(text)
    return match.group(0) if match else None
