"""Step 2: how does the shipped model do on QR-sourced URLs vs its own test split,
and why? (read-only: loads models/phishing_model_rf_3.joblib, never writes it)

    .venv/bin/python research/qr_generalization/02_evaluate_current_model.py
"""
import json
import re
import warnings
from urllib.parse import urlsplit

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, brier_score_loss, confusion_matrix,
                             f1_score, precision_score, recall_score, roc_auc_score)

from common import RES, ROOT, ece, features, host, load_phiusiil, load_qr, registrable, trusted_mask

warnings.filterwarnings("ignore")
model = cols = None


def score(name, df, tag):
    X = features(df.url, tag, cols)
    p = model.predict_proba(X)[:, 1]
    # mirror ml_inference.predict_url: allowlisted platforms short-circuit to "legitimate"
    p = np.where(trusted_mask(df.url), 0.0, p)
    y = df.label.values
    pred = (p >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred).ravel()
    r = dict(dataset=name, n=len(df), phishing_share=round(y.mean(), 3),
             accuracy=accuracy_score(y, pred), precision=precision_score(y, pred),
             recall=recall_score(y, pred), f1=f1_score(y, pred),
             roc_auc=roc_auc_score(y, p), brier=brier_score_loss(y, p), ece=ece(y, p),
             TN=tn, FP=fp, FN=fn, TP=tp, FPR=fp / (fp + tn), FNR=fn / (fn + tp))
    print({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()}, flush=True)
    return r, p



def main():
    global model, cols
    model = joblib.load(ROOT / "models" / "phishing_model_rf_3.joblib")
    cols = list(model.feature_names_in_)
    qr = load_qr()
    phi_tr, phi_te = load_phiusiil()
    print(f"QR urls: {len(qr)} | PhiUSIIL train {len(phi_tr)} test {len(phi_te)}")

    rows = []
    r, _ = score("PhiUSIIL test split (in-distribution)", phi_te, "phi_test"); rows.append(r)
    r, p_qr = score("QR-sourced URLs (shifted)", qr, "qr"); rows.append(r)
    pd.DataFrame(rows).to_csv(RES / "current_model_eval.csv", index=False)

    # ---- overlap with the training data (is the QR set seen / label-consistent?)
    phi_all = pd.concat([phi_tr.assign(split="train"), phi_te.assign(split="test")])
    norm = lambda s: s.str.strip().str.lower().str.rstrip("/")
    phi_all["n"] = norm(phi_all.url)
    qr["n"] = norm(qr.url)
    m = qr.merge(phi_all[["n", "label", "split"]].drop_duplicates("n"), on="n", how="inner", suffixes=("_qr", "_phi"))
    qr["dom"] = qr.url.map(registrable)
    phi_dom = set(phi_tr.url.map(registrable))
    overlap = {
        "qr_exact_url_in_phiusiil": int(len(m)),
        "qr_exact_url_label_agrees": int((m.label_qr == m.label_phi).sum()) if len(m) else 0,
        "qr_domain_seen_in_phi_train_share": float(qr.dom.isin(phi_dom).mean()),
    }
    print("overlap:", overlap)

    # ---- how do the URL populations differ?
    def shape(u):
        s = urlsplit(u if "://" in u else "http://" + u)
        h = (s.hostname or "")
        return dict(scheme_https=s.scheme == "https", has_path=len(s.path.strip("/")) > 0,
                    has_query=bool(s.query), www=h.startswith("www."), n_labels=h.count(".") + 1,
                    url_len=len(u), host_len=len(h), is_ip=bool(re.fullmatch(r"[\d.]+", h)),
                    digits_in_host=sum(c.isdigit() for c in h), hyphens_in_host=h.count("-"))

    def prof(df, name):
        d = pd.DataFrame([shape(u) for u in df.url.sample(min(len(df), 20000), random_state=0).values])
        d["label"] = df.loc[df.url.sample(min(len(df), 20000), random_state=0).index, "label"].values
        return d.groupby("label").mean().round(3).assign(dataset=name).reset_index()

    prof_df = pd.concat([prof(phi_te, "PhiUSIIL"), prof(qr, "QR")])
    prof_df["label"] = prof_df.label.map({0: "benign", 1: "phishing"})
    print(prof_df.to_string(index=False))
    prof_df.to_csv(RES / "url_population_profile.csv", index=False)
    json.dump(overlap, open(RES / "overlap.json", "w"), indent=2)

    # example errors
    qr["p"] = p_qr
    for lab, name in ((0, "benign flagged phishing (FP)"), (1, "phishing missed (FN)")):
        sel = qr[(qr.label == lab) & ((qr.p >= .5) == (lab == 0))].sample(8, random_state=1)
        print("\n" + name); print(sel[["url", "p"]].round(2).to_string(index=False))


if __name__ == "__main__":
    main()
