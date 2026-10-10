"""Step 1: decode a random sample of the QR dataset into URLs and cache them.

Uses the production decoder (ml_service.utils.qr_decoder). Output:
research/qr_generalization/results/qr_urls.csv  (url, label[1=malicious], file)

Run from the project root:
    .venv/bin/python research/qr_generalization/01_decode_qr_urls.py --n 20000
"""
import argparse
import glob
import random
import sys
from multiprocessing import Pool
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from ml_service.utils.qr_decoder import decode_qr, extract_url  # noqa: E402

DATASET = Path.home() / "Desktop" / "QR_Codes_Dataset"
OUT = Path(__file__).resolve().parent / "results" / "qr_urls.csv"


def work(item):
    f, label = item
    try:
        data = decode_qr(open(f, "rb").read())
    except Exception:
        data = None
    return f, label, extract_url(data) if data else None


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20000, help="images per class")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    random.seed(a.seed)
    items = []
    for cls, label in (("benign", 0), ("malicious", 1)):
        fs = sorted(glob.glob(str(DATASET / cls / "*.png")))
        items += [(f, label) for f in random.sample(fs, a.n)]
    with Pool() as p:
        res = p.map(work, items, chunksize=200)
    df = pd.DataFrame(res, columns=["file", "label", "url"])
    print("decoded:", df.url.notna().groupby(df.label).mean().round(3).to_dict())
    df = df.dropna(subset=["url"])
    df["file"] = df["file"].map(lambda f: Path(f).name)
    df.to_csv(OUT, index=False)
    print(f"saved {len(df)} rows -> {OUT}")
