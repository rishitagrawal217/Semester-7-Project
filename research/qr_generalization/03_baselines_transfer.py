"""Step 3: baselines + cross-source transfer, to separate "the model is bad" from
"the data sources differ" and to test whether path information closes the gap.
Nothing here touches the shipped model or the app.

Feature sets
  lexical  : the app's 35 domain-scoped lexical features (extract_features_v2)
  charngram: hashed char 2-5-grams of the FULL URL (incl. path/query) -> SGD logistic
Models (lexical): LogisticRegression, RandomForest(100), HistGradientBoosting
Train sources : PhiUSIIL-train | QR-train (domain-grouped 80/20) | both
Test sources  : PhiUSIIL-test  | QR-test

    .venv/bin/python research/qr_generalization/03_baselines_transfer.py
"""
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from common import RES, ROOT, features, load_phiusiil, load_qr, registrable

warnings.filterwarnings("ignore")


def metrics(y, p):
    pred = (p >= 0.5).astype(int)
    return dict(auc=roc_auc_score(y, p), acc=accuracy_score(y, pred), f1=f1_score(y, pred))


def main():
    cols = list(joblib.load(ROOT / "models" / "phishing_model_rf_3.joblib").feature_names_in_)
    qr = load_qr()
    phi_tr, phi_te = load_phiusiil()

    # QR: domain-grouped split so no registrable domain is in both train and test
    g = qr.url.map(registrable)
    tr_i, te_i = next(GroupShuffleSplit(1, test_size=0.2, random_state=42).split(qr, groups=g))
    qr_tr, qr_te = qr.iloc[tr_i].reset_index(drop=True), qr.iloc[te_i].reset_index(drop=True)
    print(f"QR train {len(qr_tr)} / test {len(qr_te)} (domain-disjoint); PhiUSIIL {len(phi_tr)}/{len(phi_te)}", flush=True)

    sets = {"PhiUSIIL-train": phi_tr, "PhiUSIIL-test": phi_te, "QR-train": qr_tr, "QR-test": qr_te}
    X = {"PhiUSIIL-train": features(phi_tr.url, "phi_train", cols),
         "PhiUSIIL-test": features(phi_te.url, "phi_test", cols),
         "QR-train": features(qr_tr.url, "qr_train", cols),
         "QR-test": features(qr_te.url, "qr_test", cols)}
    y = {k: v.label.values for k, v in sets.items()}

    lexical = {
        "LogReg": lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
        "RandomForest": lambda: RandomForestClassifier(100, n_jobs=-1, random_state=42),
        "HistGB": lambda: HistGradientBoostingClassifier(random_state=42),
    }
    train_sources = {"PhiUSIIL-train": ["PhiUSIIL-train"], "QR-train": ["QR-train"],
                     "PhiUSIIL+QR train": ["PhiUSIIL-train", "QR-train"]}

    rows = []

    def record(fs, mname, tsrc, pred_fn):
        for test in ("PhiUSIIL-test", "QR-test"):
            r = dict(feature_set=fs, model=mname, trained_on=tsrc, tested_on=test, **metrics(y[test], pred_fn(test)))
            rows.append(r)
            print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()}, flush=True)

    for tsrc, parts in train_sources.items():
        Xt = pd.concat([X[p] for p in parts]); yt = np.concatenate([y[p] for p in parts])
        for mname, mk in lexical.items():
            m = mk().fit(Xt, yt)
            record("lexical(domain)", mname, tsrc, lambda t, m=m: m.predict_proba(X[t])[:, 1])

    hv = HashingVectorizer(analyzer="char", ngram_range=(2, 5), n_features=2 ** 20, alternate_sign=False, norm="l2")
    H = {k: hv.transform(v.url.str.lower()) for k, v in sets.items()}
    import scipy.sparse as sp
    for tsrc, parts in train_sources.items():
        Ht = sp.vstack([H[p] for p in parts]); yt = np.concatenate([y[p] for p in parts])
        m = SGDClassifier(loss="log_loss", alpha=1e-6, max_iter=20, random_state=42).fit(Ht, yt)
        record("char-ngram(full URL)", "SGD-LogReg", tsrc, lambda t, m=m: m.predict_proba(H[t])[:, 1])

    pd.DataFrame(rows).to_csv(RES / "baselines_transfer.csv", index=False)
    print("saved baselines_transfer.csv")


if __name__ == "__main__":
    main()
