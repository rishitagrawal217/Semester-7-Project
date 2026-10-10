"""Shared helpers for the QR-generalization study (read-only w.r.t. the app)."""
import sys
from multiprocessing import Pool
from pathlib import Path
from urllib.parse import urlsplit

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from ml_service.utils.feature_extractor import extract_features_v2, trusted_domain_match  # noqa: E402

RES = Path(__file__).resolve().parent / "results"
CACHE = RES / "cache"
CACHE.mkdir(parents=True, exist_ok=True)


def load_qr():
    """QR URLs, label 1 = malicious (phishing)."""
    return pd.read_csv(RES / "qr_urls.csv")[["url", "label"]].drop_duplicates("url").reset_index(drop=True)


def load_phiusiil():
    """Same 80/20 stratified split (random_state=42) as train_model_calibrated.py.
    target 1 = phishing."""
    df = pd.read_csv(ROOT / "data" / "phishing_url_dataset.csv", usecols=["URL", "label"])
    df["target"] = 1 - df["label"]
    tr, te = train_test_split(df, test_size=0.2, random_state=42, stratify=df["target"])
    f = lambda d: d.drop(columns="label").rename(columns={"URL": "url", "target": "label"})[["url", "label"]].reset_index(drop=True)
    return f(tr), f(te)


def host(url):
    u = url if "://" in url else f"http://{url}"
    try:
        return (urlsplit(u).hostname or "").lower()
    except ValueError:
        return ""


def registrable(url):
    """Approximate registrable domain (last two labels; last three for common
    two-label suffixes) - used for domain-grouped splits and overlap checks."""
    labels = host(url).split(".")
    if len(labels) >= 3 and ".".join(labels[-2:]) in {"co.uk", "co.in", "com.au", "com.br", "co.jp", "co.za", "com.mx", "com.tr"}:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def _feat(u):
    try:
        return extract_features_v2(u)
    except Exception:
        return {}


def features(urls, cache_name, columns):
    """Domain-scoped lexical features (the exact extractor the live API uses),
    computed in parallel and cached."""
    p = CACHE / f"{cache_name}.pkl"
    if p.exists():
        return pd.read_pickle(p)
    with Pool() as pool:
        rows = pool.map(_feat, list(urls), chunksize=500)
    X = pd.DataFrame(rows).reindex(columns=columns).fillna(0).astype(float)
    X.to_pickle(p)
    return X


def trusted_mask(urls):
    return np.array([bool(trusted_domain_match(u)) for u in urls])


def ece(y, p, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    out = 0.0
    for b in range(bins):
        m = idx == b
        if m.any():
            out += m.mean() * abs(y[m].mean() - p[m].mean())
    return out
