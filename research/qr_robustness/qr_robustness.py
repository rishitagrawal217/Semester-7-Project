"""QR decode-robustness study.

For a random sample of benign and malicious QR images, apply one degradation
at a time at several strengths, then run the *production* pipeline on the
result: ml_service.utils.qr_decoder.decode_qr -> extract_url ->
ml_service.services.ml_inference.predict_url.

Read-only with respect to the app: nothing in ml_service/ or models/ is
modified; results are written under research/qr_robustness/results/.

Run from the project root:
    .venv/bin/python research/qr_robustness/qr_robustness.py --n 2000
"""
import argparse
import glob
import random
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from ml_service.utils.qr_decoder import decode_qr, extract_url  # noqa: E402
from ml_service.services import ml_inference  # noqa: E402

DATASET = Path.home() / "Desktop" / "QR_Codes_Dataset"
OUT = Path(__file__).resolve().parent / "results"


# --- degradations: each takes a grayscale uint8 image + strength, returns image
def blur(im, s):
    return cv2.GaussianBlur(im, (0, 0), s)


def downscale(im, s):
    return cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)


def rotate(im, deg):
    h, w = im.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), deg, 1.0)
    cos, sin = abs(m[0, 0]), abs(m[0, 1])
    nw, nh = int(h * sin + w * cos), int(h * cos + w * sin)
    m[0, 2] += nw / 2 - w / 2
    m[1, 2] += nh / 2 - h / 2
    return cv2.warpAffine(im, m, (nw, nh), borderValue=255)


def noise(im, sigma, rng=np.random.default_rng(0)):
    out = im.astype(np.float32) + rng.normal(0, sigma, im.shape)
    return np.clip(out, 0, 255).astype(np.uint8)


def jpeg(im, q):
    ok, buf = cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, int(q)])
    return cv2.imdecode(buf, cv2.IMREAD_GRAYSCALE)


def low_contrast(im, alpha):
    return np.clip(128 + alpha * (im.astype(np.float32) - 128), 0, 255).astype(np.uint8)


def occlude(im, frac):
    """Grey square covering `frac` of the image area, placed over the centre."""
    h, w = im.shape
    side = int((frac * h * w) ** 0.5)
    y0, x0 = (h - side) // 2, (w - side) // 2
    out = im.copy()
    out[y0:y0 + side, x0:x0 + side] = 128
    return out


CONDITIONS = [("clean", 0, lambda im, s: im)]
for name, fn, levels in [
    ("blur_sigma", blur, [1, 2, 4, 6]),
    ("downscale_factor", downscale, [0.75, 0.5, 0.35, 0.25]),
    ("rotation_deg", rotate, [5, 15, 30, 45]),
    ("gaussian_noise_sigma", noise, [10, 25, 50, 80]),
    ("jpeg_quality", jpeg, [50, 20, 10, 5]),
    ("contrast_alpha", low_contrast, [0.5, 0.3, 0.15, 0.08]),
    ("occlusion_area", occlude, [0.02, 0.05, 0.10, 0.20]),
]:
    for lv in levels:
        CONDITIONS.append((name, lv, fn))


def encode_png(im):
    return cv2.imencode(".png", im)[1].tobytes()


_verdict_cache = {}


def verdict(url):
    if url not in _verdict_cache:
        _verdict_cache[url] = ml_inference.predict_url(url)["is_phishing"]
    return _verdict_cache[url]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=2000, help="images per class")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)
    files = []
    for cls in ("benign", "malicious"):
        fs = sorted(glob.glob(str(DATASET / cls / "*.png")))
        files += [(f, cls) for f in random.sample(fs, args.n)]
    print(f"{len(files)} images; {len(CONDITIONS)} conditions", flush=True)

    ml_inference.load_model()
    images = [(cv2.imread(f, cv2.IMREAD_GRAYSCALE), cls) for f, cls in files]

    clean_url = {}   # image index -> URL decoded from the clean image
    rows = []
    for name, level, fn in CONDITIONS:
        t0 = time.time()
        tot = {"benign": 0, "malicious": 0}
        dec = {"benign": 0, "malicious": 0}
        same_url = same_verdict = correct = n_url = 0
        n_clean_ok = n_clean_ok_dec = 0
        for i, (im, cls) in enumerate(images):
            tot[cls] += 1
            try:
                data = decode_qr(encode_png(fn(im, level)))
            except Exception:
                data = None
            url = extract_url(data) if data else None
            if name == "clean":
                clean_url[i] = url
            if data:
                dec[cls] += 1
            if clean_url.get(i):
                n_clean_ok += 1
                if url:
                    n_clean_ok_dec += 1
                    same_url += url == clean_url[i]
                    same_verdict += verdict(url) == verdict(clean_url[i])
            if url:
                n_url += 1
                correct += verdict(url) == (cls == "malicious")
        n = sum(tot.values())
        rows.append({
            "degradation": name, "level": level,
            "decode_rate": sum(dec.values()) / n,
            "decode_rate_benign": dec["benign"] / tot["benign"],
            "decode_rate_malicious": dec["malicious"] / tot["malicious"],
            "recovery_of_clean_decodable": n_clean_ok_dec / n_clean_ok if n_clean_ok else np.nan,
            "same_url_rate": same_url / n_clean_ok_dec if n_clean_ok_dec else np.nan,
            "verdict_consistency": same_verdict / n_clean_ok_dec if n_clean_ok_dec else np.nan,
            "verdict_accuracy_vs_folder": correct / n_url if n_url else np.nan,
            "n_images": n,
        })
        r = rows[-1]
        print(f"{name:22s} {level!s:>6}  decode={r['decode_rate']:.3f}  "
              f"verdict_consistency={r['verdict_consistency']:.3f}  ({time.time()-t0:.0f}s)", flush=True)

    OUT.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_csv(OUT / "qr_robustness.csv", index=False)
    plot(df)
    print(f"saved to {OUT}")


def plot(df):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    clean = df[df.degradation == "clean"].iloc[0]
    groups = [g for g in df.degradation.unique() if g != "clean"]
    fig, axes = plt.subplots(2, 4, figsize=(16, 7))
    for ax, g in zip(axes.flat, groups):
        d = df[df.degradation == g]
        x = [str(v) for v in d.level]
        ax.plot(x, d.decode_rate, "o-", label="decode rate")
        ax.plot(x, d.verdict_consistency, "s--", label="verdict consistency")
        ax.axhline(clean.decode_rate, color="grey", lw=0.8, ls=":")
        ax.set_title(g)
        ax.set_ylim(0, 1.05)
        ax.grid(alpha=0.3)
    axes.flat[0].legend(fontsize=8)
    for ax in axes.flat[len(groups):]:
        ax.axis("off")
    fig.suptitle("QR decode robustness (dotted = clean decode rate)")
    fig.tight_layout()
    fig.savefig(OUT / "qr_robustness.png", dpi=160)


if __name__ == "__main__":
    main()
