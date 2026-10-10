"""Step 4: shortcut check. Both datasets' benign URLs almost always start with
"https://www." while phishing URLs mostly don't. Strip the scheme and a leading
"www." from every URL and repeat the key experiments. If scores collapse, they
were measuring that prefix, not phishing.

    .venv/bin/python research/qr_generalization/04_artifact_ablation.py
"""
import re
import warnings

import joblib
import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit

from common import RES, ROOT, features, load_phiusiil, load_qr, registrable, trusted_mask

warnings.filterwarnings("ignore")
STRIP = re.compile(r"^[a-z][a-z0-9+.-]*://(www\.)?", re.I)


def strip(u):
    return STRIP.sub("", u.strip())


def metrics(y, p):
    pred = (p >= 0.5).astype(int)
    return dict(auc=roc_auc_score(y, p), acc=accuracy_score(y, pred), f1=f1_score(y, pred))


def main():
    shipped = joblib.load(ROOT / "models" / "phishing_model_rf_3.joblib")
    cols = list(shipped.feature_names_in_)
    qr = load_qr()
    phi_tr, phi_te = load_phiusiil()
    g = qr.url.map(registrable)
    tr_i, te_i = next(GroupShuffleSplit(1, test_size=0.2, random_state=42).split(qr, groups=g))
    sets = {"PhiUSIIL-train": phi_tr, "PhiUSIIL-test": phi_te,
            "QR-train": qr.iloc[tr_i].reset_index(drop=True), "QR-test": qr.iloc[te_i].reset_index(drop=True)}
    S = {k: v.url.map(strip) for k, v in sets.items()}          # prefix-stripped text
    y = {k: v.label.values for k, v in sets.items()}
    X = {k: features(["http://" + u for u in S[k]], "norm_" + k, cols) for k in sets}  # uniform scheme, no www

    rows = []

    def rec(name, trained, tested, p):
        r = dict(model=name, trained_on=trained, tested_on=tested, **metrics(y[tested], p))
        rows.append(r)
        print({k: (round(float(v), 3) if not isinstance(v, str) else v) for k, v in r.items()}, flush=True)

    for t in ("PhiUSIIL-test", "QR-test"):                       # shipped model, prefix removed
        p = shipped.predict_proba(X[t])[:, 1]
        p = np.where(trusted_mask(["http://" + u for u in S[t]]), 0.0, p)
        rec("shipped RF (as deployed)", "PhiUSIIL-train", t, p)

    for tsrc, trn in (("PhiUSIIL-train", ["PhiUSIIL-train"]), ("QR-train", ["QR-train"])):
        m = HistGradientBoostingClassifier(random_state=42).fit(pd.concat([X[k] for k in trn]), np.concatenate([y[k] for k in trn]))
        for t in ("PhiUSIIL-test", "QR-test"):
            rec("lexical HistGB", tsrc, t, m.predict_proba(X[t])[:, 1])

    hv = HashingVectorizer(analyzer="char", ngram_range=(2, 5), n_features=2 ** 20, alternate_sign=False, norm="l2")
    H = {k: hv.transform(S[k].str.lower()) for k in sets}
    for tsrc in ("PhiUSIIL-train", "QR-train"):
        m = SGDClassifier(loss="log_loss", alpha=1e-6, max_iter=20, random_state=42).fit(H[tsrc], y[tsrc])
        for t in ("PhiUSIIL-test", "QR-test"):
            rec("char-ngram full URL", tsrc, t, m.predict_proba(H[t])[:, 1])

    # Same-source, same-prefix-stripped sanity: how separable are the classes by prefix alone?
    for name, df in (("PhiUSIIL", phi_te), ("QR", sets["QR-test"])):
        pref = df.url.str.extract(r"^(https?://(?:www\.)?)", expand=False).fillna("other")
        print(f"\nprefix x class ({name}):\n", pd.crosstab(pref, df.label.map({0: 'benign', 1: 'phishing'}), normalize="columns").round(3))
    pd.DataFrame(rows).to_csv(RES / "artifact_ablation.csv", index=False)
    print("saved artifact_ablation.csv")


if __name__ == "__main__":
    main()
