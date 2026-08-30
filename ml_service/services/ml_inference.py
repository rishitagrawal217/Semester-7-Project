import joblib
import numpy as np
from pathlib import Path
from ..utils.feature_extractor import extract_features, extract_features_v2

try:
    import shap
except ImportError:
    shap = None

# Calibrated RandomForest scoped to domain-style URLs, trained on lexical
# features recomputed straight from the URL string (see
# train_model_calibrated.py) - no train/serve skew, better-calibrated
# confidence than the old rf_2 model, and no longer flags ordinary
# subdomain/path URLs (github.com/login, accounts.google.com/...) as phishing.
_PRIMARY_MODEL_PATH = Path("models/phishing_model_rf_3.joblib")
# Original URL-only RandomForest - kept as a fallback in case the primary model
# is missing (e.g. not yet retrained/committed in this environment).
_FALLBACK_MODEL_PATH = Path("models/phishing_model_rf_2.joblib")

# Human-readable description of what each feature measures. Only the
# direction-agnostic fact is hardcoded here - whether a given value actually
# pushes a prediction toward "phishing" or "legitimate" comes from that
# feature's live SHAP contribution, not an assumption baked in up front
# (e.g. https_token=1 means "https" literally appears in the hostname text,
# a spoofing trick - it is not "the site uses HTTPS").
FEATURE_INFO = {
    "ip": {
        "label": "IP address as hostname",
        "detail": lambda v: "the hostname is a raw IP address" if v else "the hostname is not a raw IP address",
    },
    "https_token": {
        "label": '"https" in hostname text',
        "detail": lambda v: 'the word "https" appears in the hostname itself' if v else 'the word "https" does not appear in the hostname',
    },
    "nb_hyphens": {
        "label": "Hyphens in hostname",
        "detail": lambda v: f"the hostname contains {int(v)} hyphen(s)",
    },
    "nb_at": {
        "label": "'@' in URL",
        "detail": lambda v: f"the URL contains {int(v)} '@' character(s)",
    },
    "nb_subdomains": {
        "label": "Subdomain count",
        "detail": lambda v: f"the hostname has {int(v)} subdomain label(s)",
    },
    "abnormal_subdomain": {
        "label": "Unusually deep subdomains",
        "detail": lambda v: "the hostname has an unusually high number of subdomains" if v else "the hostname's subdomain depth is ordinary",
    },
    "prefix_suffix": {
        "label": "Hyphen in domain name",
        "detail": lambda v: "the registrable domain itself contains a hyphen" if v else "the registrable domain has no hyphen",
    },
    "suspecious_tld": {
        "label": "Commonly-abused TLD",
        "detail": lambda v: "the top-level domain (e.g. .tk, .xyz, .top) is one commonly abused for phishing" if v else "the top-level domain is not one of the commonly abused ones",
    },
    "known_tld": {
        "label": "Recognized TLD",
        "detail": lambda v: "the top-level domain is a well-established one" if v else "the top-level domain is unusual or unrecognized",
    },
    "shortening_service": {
        "label": "URL shortener",
        "detail": lambda v: "the domain is a known URL-shortening service" if v else "the domain is not a known URL shortener",
    },
    "punycode": {
        "label": "Punycode encoding",
        "detail": lambda v: 'the hostname uses punycode ("xn--") encoding' if v else "the hostname has no punycode encoding",
    },
    "random_domain": {
        "label": "Randomly-generated-looking domain",
        "detail": lambda v: "the domain name looks randomly generated (long, few vowels)" if v else "the domain name doesn't look randomly generated",
    },
    "phish_hints": {
        "label": "Phishing-related keywords",
        "detail": lambda v: f"the hostname contains {int(v)} phishing-related keyword(s) (e.g. 'login', 'verify', 'secure')" if v else "the hostname contains no common phishing keywords",
    },
    "nb_www": {
        "label": '"www." prefix',
        "detail": lambda v: 'the hostname starts with "www."' if v else 'the hostname does not start with "www."',
    },
    "port": {
        "label": "Explicit port number",
        "detail": lambda v: "the URL specifies an explicit port number" if v else "the URL has no explicit port number",
    },
    "char_repeat": {
        "label": "Repeated characters",
        "detail": lambda v: f"the longest run of one repeated character in the hostname is {int(v)}",
    },
    "length_hostname": {
        "label": "Hostname length",
        "detail": lambda v: f"the hostname is {int(v)} characters long",
    },
    "length_url": {
        "label": "URL length",
        "detail": lambda v: f"the domain portion of the URL is {int(v)} characters long",
    },
    "ratio_digits_host": {
        "label": "Digit ratio in hostname",
        "detail": lambda v: f"{v * 100:.0f}% of the hostname's characters are digits",
    },
    "tld_in_subdomain": {
        "label": "TLD used as a subdomain",
        "detail": lambda v: "a real TLD (like .com) appears as a subdomain label instead of the actual ending" if v else "no TLD appears as a subdomain label",
    },
    "nb_dots": {
        "label": "Dots in hostname",
        "detail": lambda v: f"the hostname contains {int(v)} dot(s)",
    },
    "nb_colon": {
        "label": "Colons in URL",
        "detail": lambda v: f"the URL contains {int(v)} colon(s)",
    },
    "nb_underscore": {
        "label": "Underscores in hostname",
        "detail": lambda v: f"the hostname contains {int(v)} underscore(s)",
    },
    "nb_tilde": {
        "label": "Tildes in hostname",
        "detail": lambda v: f"the hostname contains {int(v)} tilde character(s)",
    },
    "nb_percent": {
        "label": "Percent signs in hostname",
        "detail": lambda v: f"the hostname contains {int(v)} percent sign(s)",
    },
    "nb_com": {
        "label": "'.com' occurrences",
        "detail": lambda v: f"the hostname contains '.com' {int(v)} time(s)",
    },
    "ratio_digits_url": {
        "label": "Digit ratio in URL",
        "detail": lambda v: f"{v * 100:.0f}% of the domain portion's characters are digits",
    },
    "length_words_host": {
        "label": "Word count in hostname",
        "detail": lambda v: f"the hostname breaks down into {int(v)} word-like piece(s)",
    },
    "shortest_word_host": {
        "label": "Shortest word in hostname",
        "detail": lambda v: f"the shortest word-like piece in the hostname is {int(v)} character(s) long",
    },
    "longest_word_host": {
        "label": "Longest word in hostname",
        "detail": lambda v: f"the longest word-like piece in the hostname is {int(v)} character(s) long",
    },
    "avg_word_host": {
        "label": "Average word length in hostname",
        "detail": lambda v: f"the hostname's word-like pieces average {v:.1f} characters",
    },
    "path_extension": {
        "label": "Executable-style path extension",
        "detail": lambda v: "the path ends in an executable/script-style extension (.php, .exe, ...)" if v else "the path has no executable/script-style extension",
    },
    "tld_in_path": {
        "label": "TLD appears in the path",
        "detail": lambda v: "a known TLD (like .com) appears inside the path, not just the hostname" if v else "no known TLD appears inside the path",
    },
    "http_in_path": {
        "label": "'http' inside the path",
        "detail": lambda v: "the literal text 'http' appears inside the path or query" if v else "the literal text 'http' does not appear inside the path or query",
    },
    "nb_dslash": {
        "label": "Double slashes in path",
        "detail": lambda v: f"the path/query contains {int(v)} double-slash occurrence(s)",
    },
}


def _describe_feature(name: str, value) -> tuple:
    info = FEATURE_INFO.get(name)
    label = info["label"] if info else name.replace("_", " ").title()
    detail = info["detail"](value) if info else f"{label} = {value}"
    return label, detail


model = None
feature_fn = None
explainers = None  # list of (shap.TreeExplainer, phishing_class_index), one per CV fold


def load_model():
    global model, feature_fn, explainers
    if _PRIMARY_MODEL_PATH.exists():
        model = joblib.load(_PRIMARY_MODEL_PATH)
        feature_fn = extract_features_v2
        print(f"Model loaded successfully: {_PRIMARY_MODEL_PATH}")

        if shap is not None:
            try:
                explainers = []
                for calibrated_classifier in model.calibrated_classifiers_:
                    estimator = calibrated_classifier.estimator
                    phishing_idx = list(estimator.classes_).index(1)
                    explainers.append((shap.TreeExplainer(estimator), phishing_idx))
            except Exception as exc:
                print(f"SHAP explainer setup failed, explanations disabled: {exc}")
                explainers = None
    elif _FALLBACK_MODEL_PATH.exists():
        model = joblib.load(_FALLBACK_MODEL_PATH)
        feature_fn = extract_features
        explainers = None
        print(f"Primary model not found - falling back to {_FALLBACK_MODEL_PATH}")
    else:
        print("No model found - using dummy fallback")


def explain_prediction(feature_vector: list, feature_names: list, top_k: int = 5) -> list:
    """Average SHAP contributions toward the "phishing" class across the 5
    CalibratedClassifierCV folds, and return the top_k most influential
    features as human-readable entries. Expensive (~0.7s) - only call this
    for explicit, user-initiated checks, never on the proxy's hot path."""
    if not explainers:
        return []

    vec = np.array([feature_vector], dtype=float)
    contributions = np.zeros(len(feature_names))
    for explainer, phishing_idx in explainers:
        sv = np.asarray(explainer.shap_values(vec))
        contributions += sv[0, :, phishing_idx]
    contributions /= len(explainers)

    order = np.argsort(-np.abs(contributions))[:top_k]
    explanation = []
    for i in order:
        name = feature_names[i]
        value = feature_vector[i]
        label, detail = _describe_feature(name, value)
        contribution = float(contributions[i])
        explanation.append({
            "feature": name,
            "label": label,
            "detail": detail,
            "value": value,
            "contribution": contribution,
            "direction": "phishing" if contribution > 0 else "legitimate",
        })
    return explanation


def predict_url(url: str, explain: bool = False):
    if model is None:
        load_model()

    if model is None:
        return {"is_phishing": False, "confidence": 0.5, "features": {}, "explanation": []}

    features_dict = feature_fn(url)
    feature_names = list(model.feature_names_in_)
    feature_vector = [features_dict.get(col, 0) for col in feature_names]

    prediction = model.predict([feature_vector])[0]
    probability = model.predict_proba([feature_vector])[0].max()

    explanation = explain_prediction(feature_vector, feature_names) if explain else []

    return {
        "is_phishing": bool(prediction),
        "confidence": float(probability),
        "features": features_dict,
        "explanation": explanation,
    }
