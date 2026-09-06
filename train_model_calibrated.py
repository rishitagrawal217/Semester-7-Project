"""Retrain the phishing detector, scoped to plain domain-style URLs.

Two things matter about how this is trained:

1. Feature values are not read from the dataset's precomputed columns - they
   are recomputed straight from the raw `URL` column using
   ml_service.utils.feature_extractor.extract_features_v2, the exact same
   function the live API calls at inference time. This guarantees zero
   train/serve skew.

2. Scope is deliberately narrowed to the *domain* part of the URL (scheme +
   optional www/subdomain + registrable domain + a recognized extension).
   Path/query content is intentionally not scored. Early iterations that did
   score full-URL/path statistics learned "does this URL have a path" as a
   proxy for phishing, which flagged completely ordinary pages like
   github.com/login as phishing. Restricting scope to the hostname avoids
   that failure mode, at the cost of missing phishing tactics that only show
   up in a URL's path or query string (a known, accepted limitation - see
   README). Separately, our lexical-only feature set has no concept of
   domain reputation, so a small hardcoded allowlist in feature_extractor.py
   (trusted_domain_match) catches major platforms' subdomains
   (mail.google.com, login.microsoftonline.com) before they ever reach this
   model - see ml_service/services/ml_inference.py.

Dataset: data/phishing_url_dataset.csv (235K rows, a PhiUSIIL-style dataset -
25x larger than the original ~9K-row set this project started with). Its
`label` column is 1 = legitimate, 0 = phishing - the OPPOSITE of this
project's convention - so it's remapped below. It also has its own bias: every
legitimate example has *some* subdomain (almost always "www."), while a good
chunk of phishing examples are bare apex domains, so we apply the same
www-deduplication augmentation as before to avoid the model learning
"no www => phishing".

n_estimators=100 (not the more obvious 300) is a deliberate choice: benchmarked
against a 500+500 sample QR-code dataset, 300 unconstrained trees produced a
1.97GB model with no accuracy gain over 100 trees (627MB) at the same depth -
constraining depth/leaf-size instead (a more typical way to shrink a forest)
measurably hurt real-world generalization in that same benchmark. Fewer
full-depth trees was the only lever that shrank the model without giving up
accuracy.
"""
import pandas as pd
import joblib
from pathlib import Path
from urllib.parse import urlsplit
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, roc_auc_score, brier_score_loss

from ml_service.utils.feature_extractor import extract_features_v2


def augment_with_bare_domain_variants(urls, targets):
    """For every URL whose host starts with 'www.', add a bare-domain
    duplicate with the same label - example.com and www.example.com are the
    same site, so this corrects the dataset's www-skew without inventing
    labels."""
    aug_urls, aug_targets = [], []
    for u, t in zip(urls, targets):
        aug_urls.append(u)
        aug_targets.append(t)
        candidate = u if "://" in u else f"http://{u}"
        hostname = urlsplit(candidate).hostname or ""
        if hostname.startswith("www."):
            aug_urls.append(u.replace("://www.", "://", 1))
            aug_targets.append(t)
    return aug_urls, aug_targets


# Load dataset (only the URL + label columns are used; all model features are
# recomputed from the raw URL, not taken from the dataset's own precomputed columns)
df = pd.read_csv("data/phishing_url_dataset.csv")
df["target"] = 1 - df["label"]  # this dataset's label=1 is legitimate; we want 1=phishing

urls_train, urls_test, y_train_raw, y_test_raw = train_test_split(
    df["URL"], df["target"], test_size=0.2, random_state=42, stratify=df["target"]
)

aug_urls_train, aug_y_train = augment_with_bare_domain_variants(
    urls_train.tolist(), y_train_raw.tolist()
)
print(f"Training rows: {len(urls_train)} -> {len(aug_urls_train)} after www augmentation")

print("Extracting domain-scoped lexical features...")
X_train = pd.DataFrame([extract_features_v2(u) for u in aug_urls_train])
y_train = pd.Series(aug_y_train)
X_test = pd.DataFrame([extract_features_v2(u) for u in urls_test])[X_train.columns]
y_test = y_test_raw.reset_index(drop=True)
print(f"Feature matrix: {X_train.shape}")

base_model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
model = CalibratedClassifierCV(base_model, method="isotonic", cv=5)
model.fit(X_train, y_train)

proba_test = model.predict_proba(X_test)[:, 1]
pred_test = (proba_test >= 0.5).astype(int)

print("\nClassification Report:")
print(classification_report(y_test, pred_test, target_names=["legitimate", "phishing"]))
print(f"ROC-AUC: {roc_auc_score(y_test, proba_test):.4f}")
print(f"Brier score: {brier_score_loss(y_test, proba_test):.4f}")

# Save model
model_path = Path("models/phishing_model_rf_3.joblib")
model_path.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(model, model_path)
print(f"\nModel saved successfully at: {model_path}")
