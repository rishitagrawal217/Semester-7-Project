# QR-sourced URL generalization — findings

Scripts (run from project root, in order): `01_decode_qr_urls.py` → `02_evaluate_current_model.py`
→ `03_baselines_transfer.py` → `04_artifact_ablation.py`. Outputs in `results/*.csv`.
The app, API and shipped model (`models/phishing_model_rf_3.joblib`) are never modified.

Data: 34,899 unique URLs decoded from a random 20k+20k sample of the QR dataset (label 1 = malicious),
and the PhiUSIIL CSV with the same 80/20 stratified split (random_state=42) as `train_model_calibrated.py`.

## 1. Shipped model: in-distribution vs QR-sourced URLs (`current_model_eval.csv`)
| Test set | Acc | Precision | Recall | F1 | ROC-AUC | ECE |
|---|---|---|---|---|---|---|
| PhiUSIIL test split | 0.846 | 0.989 | 0.647 | 0.782 | 0.881 | 0.143 |
| QR-sourced URLs | 0.555 | 0.590 | 0.345 | 0.435 | 0.703 | 0.380 |

High precision / low recall even in-distribution: the domain-only scope misses path-borne phishing.
On QR URLs it is close to chance, and badly mis-calibrated.

## 2. The two sources are different populations (`url_population_profile.csv`, `overlap.json`)
Benign URLs with a path: PhiUSIIL 0% vs QR 77.5%. Phishing URLs using https: PhiUSIIL 49% vs QR 5.6%.
Only 72 QR URLs appear verbatim in PhiUSIIL (labels agree on all 72); 13.6% of QR domains occur in PhiUSIIL-train.

## 3. Baselines and transfer (`baselines_transfer.csv`, AUC)
| Features / model | Train→PhiUSIIL-test | Train→QR-test |
|---|---|---|
| lexical RF, trained on PhiUSIIL | 0.914 | 0.865 |
| lexical HistGB, trained on PhiUSIIL | 0.917 | 0.914 |
| char-ngram full URL, trained on PhiUSIIL | 0.999 | 0.996 (acc only 0.68) |
| char-ngram full URL, trained on QR | 0.995 | 0.999 |

## 4. Shortcut check — the important caveat (`artifact_ablation.csv`)
In both datasets, `https://www.` is a near-perfect benign marker: 100% of benign URLs have it, versus
2.5% of PhiUSIIL phishing and 0.6% of QR phishing. Section 3's near-perfect scores are therefore
largely prefix detection. After stripping the scheme and leading `www.` from every URL:

| Model | trained on | Test PhiUSIIL AUC | Test QR AUC |
|---|---|---|---|
| shipped RF (as deployed) | PhiUSIIL | 0.868 | **0.501** |
| lexical HistGB | PhiUSIIL | 0.890 | 0.494 |
| lexical HistGB | QR | 0.672 | 0.766 |
| char-ngram full URL | PhiUSIIL | 0.950 | 0.626 |
| char-ngram full URL | QR | 0.797 | 0.965 |

Conclusions supported by the data: (a) headline benchmark numbers on these two datasets are inflated by a
construction artifact; (b) once removed, a PhiUSIIL-trained model does not transfer to QR-sourced URLs
(AUC ≈ 0.5 for lexical features); (c) path/full-URL features help within a source but transfer poorly.

## Limitations (state these in any paper)
- Labels are taken from the datasets as-is; neither dataset's provenance/labelling was independently audited.
- QR URLs come from one QR dataset whose payloads are `str()` of pandas rows (see `qr_decoder.extract_url`).
- Domain grouping uses an approximate registrable-domain heuristic, not the public-suffix list.
- Single random seed / single split; no confidence intervals yet.
- Prefix stripping removes only the scheme and leading `www.`; other shortcuts may remain.
