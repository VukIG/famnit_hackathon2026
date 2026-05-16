"""
Step 4 & 5 validation script.
- Step 4: old scorer vs new scorer on the same 15 images from plan-scan Section 6a.
- Step 5: 50-image full validation (stratified by camera, different from calibration set).
Writes plan-scan-fix-validation.md at the project root.
"""
import os
import sys
import warnings
warnings.filterwarnings("ignore")

import glob
import numpy as np
import cv2
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from scorer import score_image, reload_calibration, _dark_channel_raw, CALIBRATION_PATH

reload_calibration()  # pick up freshly written calibration.json

BASE_MODEL = r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model"
BASE_DATA  = os.path.join(BASE_MODEL, "data")
OUT_PATH   = r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\plan-scan-fix-validation.md"

# ── Exact 15 images from plan-scan Section 6a ─────────────────────────────────
FIFTEEN = [
    # idx, split, relative path, expected_characteristic
    (1,  "train", r"data\train\images\20231016-173101-IPC608_8B64_165.jpg",  "dark/night"),
    (2,  "train", r"data\train\images\20231002-055401-IPC608_8B64_165.jpg",  "?"),
    (3,  "train", r"data\train\images\20231018-105601-IPC608_8B64_165.jpg",  "?"),
    (4,  "train", r"data\train\images\20240401-141501-AIPC608UW_10_167.jpg", "?"),
    (5,  "train", r"data\train\images\20230404-120000-C4k0193.jpg",          "likely clear 4K"),
    (6,  "valid", r"data\valid\images\20231202-142401-IPC608_8B64_165.jpg",  "high DCP"),
    (7,  "valid", r"data\valid\images\20231001-102401-IPC608_8B64_165.jpg",  "?"),
    (8,  "valid", r"data\valid\images\20240411-121901-IPC608_8B64_165.jpg",  "?"),
    (9,  "valid", r"data\valid\images\20240505-160901-IPC608_8BC7_166.jpg",  "?"),
    (10, "valid", r"data\valid\images\20230404-160000-C4k0193.jpg",          "likely clear 4K"),
    (11, "test",  r"data\test\images\20240229-132001-IPC608_8B64_165.jpg",   "high DCP"),
    (12, "test",  r"data\test\images\20240306-Video-2-IPC608_8B64_166_frame087.jpg", "?"),
    (13, "test",  r"data\test\images\20231007-090201-IPC608_8B64_165.jpg",   "?"),
    (14, "test",  r"data\test\images\20240410-120800-Video-AIPC608UW_10_167_frame010.jpg", "?"),
    (15, "test",  r"data\test\images\20230325-180000-C4k0193.jpg",           "?"),
]

# ── Old scorer (verbatim from main.ipynb Cells 5+6) ───────────────────────────
def _old_pre_processing(image_sample):
    img_arr = np.array(Image.open(image_sample))
    alpha, beta = 2, 255
    raw_img = np.clip(img_arr.astype(np.float64) * alpha + beta, 0, 65535).astype(np.float64)
    first_method = raw_img.copy()
    se  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    bg  = cv2.morphologyEx(first_method, cv2.MORPH_DILATE, se)
    out = cv2.divide(first_method, bg, scale=255)
    out = 255 - out
    img = out.astype(np.uint8)
    img = cv2.fastNlMeansDenoising(img, None, 4, 10, 7)
    return cv2.GaussianBlur(img, (3, 3), 0)

def _old_dark_channel(img, patch_size=15):
    min_c  = np.min(img, axis=2)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (patch_size, patch_size))
    return cv2.erode(min_c, kernel)

def _old_score_image(path):
    try:
        blurred = _old_pre_processing(path)
        img_rgb = np.array(Image.open(path)).astype(np.float32)
        if img_rgb.max() > 255:
            img_rgb = (img_rgb / 65535.0 * 255.0)
        img_rgb = img_rgb.astype(np.uint8)

        dc  = _old_dark_channel(img_rgb.astype(np.float32) / 255.0)
        dcs = float(np.mean(dc)) * 100

        gray = blurred.astype(np.float32)
        co   = (1.0 - float(np.std(gray) / 255.0)) * 100

        r, g, b  = img_rgb[:,:,0].astype(np.float32), img_rgb[:,:,1].astype(np.float32), img_rgb[:,:,2].astype(np.float32)
        mr, mg, mb = np.mean(r), np.mean(g), np.mean(b)
        total    = mr + mg + mb + 1e-6
        ra       = np.clip(1.0 - (mr / (total / 3.0 + 1e-6)), 0, 1)
        cl       = float(ra) * 100

        lap      = cv2.Laplacian(blurred, cv2.CV_64F)
        sh       = (1.0 - np.clip(float(np.var(lap)) / 300.0, 0, 1)) * 100

        rg, yb   = r - g, 0.5 * (r + g) - b
        uicm     = -0.0268 * np.sqrt(np.mean(rg)**2 + np.mean(yb)**2) + 0.1586 * np.sqrt(np.std(rg)**2 + np.std(yb)**2)
        ui       = (1.0 - np.clip((float(uicm) + 10) / 20.0, 0, 1)) * 100

        score = 0.30*dcs + 0.25*co + 0.20*sh + 0.15*cl + 0.10*ui
        return round(float(np.clip(score, 0, 100)), 2)
    except Exception as e:
        return f"ERROR: {e}"


# ── Step 5 sampling (stratified by camera, different set from calibration) ─────
CAMERAS = ["IPC608_8B64_165", "IPC608_8BC7_166", "AIPC608UW_10_167", "C4k0193"]

def gather_step5(n_total=50):
    # Use a different seed from calibration (42) to pick different images
    rng = np.random.default_rng(137)
    all_images = []
    for split in ("train", "valid", "test"):
        all_images += glob.glob(os.path.join(BASE_DATA, split, "images", "*.jpg"))
    buckets = {cam: [] for cam in CAMERAS}
    other = []
    for p in all_images:
        name = os.path.basename(p)
        matched = False
        for cam in CAMERAS:
            if cam in name:
                buckets[cam].append(p)
                matched = True
                break
        if not matched:
            other.append(p)
    selected = []
    n_each = n_total // len(CAMERAS)
    for cam in CAMERAS:
        pool = sorted(buckets[cam])
        n    = min(n_each, len(pool))
        idx  = rng.choice(len(pool), size=n, replace=False)
        selected += [pool[i] for i in sorted(idx)]
    remaining = n_total - len(selected)
    if remaining > 0 and other:
        pool = sorted(other)
        n    = min(remaining, len(pool))
        idx  = rng.choice(len(pool), size=n, replace=False)
        selected += [pool[i] for i in sorted(idx)]
    return selected


def run_all():
    lines = []
    def p(s=""):
        lines.append(s)

    p("# plan-scan-fix-validation.md")
    p("**Date:** 2026-05-16  ")
    p("**Branch:** improve/model  ")
    p("**Purpose:** Before/after validation of Fixes 1–9 from plan-scan.md Section 8.")
    p()

    # ── Fix summary table ──────────────────────────────────────────────────────
    p("## Applied Fixes Summary")
    p()
    p("| Fix | Description | Status |")
    p("|-----|-------------|--------|")
    p("| Fix 1 | Remove pre_processing() from scoring path; score on original image | Applied — scorer.py uses raw image for all metrics |")
    p("| Fix 2 | Tenengrad on LAB L-channel (resolution-independent, JPEG-robust) | Applied — scorer.py:tenengrad_sharpness() |")
    p("| Fix 3 | Blue dominance ratio B/R replaces red attenuation formula | Applied — scorer.py:blue_dominance() |")
    p("| Fix 4 | UICM computed on 0–1 normalized pixels (correct per paper) | Applied — scorer.py:uicm_normalized() |")
    p("| Fix 5 | clarity_score = 100 - turbidity; primary output direction corrected | Applied — score_image() returns clarity_score |")
    p("| Fix 6 | Resize to 800×600 + 8% border crop before metric computation | Applied — preprocess_for_metrics() |")
    p("| Fix 7 | Calibration from 50 images → calibration.json; p5/p95 bounds | Applied — _calibrate.py produced calibration.json |")
    p("| Fix 8 | Batch scorer writing labels/visibility_scores.csv | Deferred — implemented as Cell 4 of main.ipynb |")
    p("| Fix 9 | Dead code (Cells 0,1,2,4) moved to experiments.ipynb | Applied — see main.ipynb refactor |")
    p()

    # ── Step 4: 15-image old vs new ───────────────────────────────────────────
    p("## Step 4: Old vs New — 15-Image Comparison")
    p()
    p("Images are the exact 15 from plan-scan.md Section 6a.")
    p()
    p("| # | Image | Sz | OLD score | NEW clarity | Delta | Unscoreable? |")
    p("|---|-------|----|-----------|-------------|-------|--------------|")

    old_scores = []
    new_clarities = []
    new_turbidities = []
    step4_rows = []

    for idx, split, rel_path, desc in FIFTEEN:
        full = os.path.join(BASE_MODEL, rel_path)
        name = os.path.basename(full)[:38]
        kb   = os.path.getsize(full) // 1024

        old  = _old_score_image(full)
        new  = score_image(full)

        if isinstance(old, str) and old.startswith("ERROR"):
            old_str = old
        else:
            old_str = f"{old:.1f}"
            old_scores.append(old)

        if new["clarity_score"] is None:
            new_str   = "UNSCOREABLE"
            delta_str = "—"
            unscore   = f"✓ ({new['unscoreable_reason']})"
        else:
            new_str   = f"{new['clarity_score']:.1f}"
            delta_str = f"{new['clarity_score'] - (100 - (old if isinstance(old, float) else 0)):.1f}" if isinstance(old, float) else "—"
            unscore   = ""
            new_clarities.append(new["clarity_score"])
            new_turbidities.append(new["turbidity_score"])

        p(f"| {idx} | {name} | {kb}K | {old_str} | {new_str} | {delta_str} | {unscore} |")
        step4_rows.append((idx, old, new, desc))

    p()
    p("### Distribution Comparison")
    p()
    if old_scores:
        p(f"**OLD scorer** (turbidity, n={len(old_scores)} scoreable):")
        p(f"- Range: {min(old_scores):.1f} – {max(old_scores):.1f}  (spread: {max(old_scores)-min(old_scores):.1f} pts)")
        p(f"- Std: {np.std(old_scores):.2f}")
        p()

    if new_clarities:
        p(f"**NEW scorer** (clarity, n={len(new_clarities)} scoreable):")
        p(f"- Range: {min(new_clarities):.1f} – {max(new_clarities):.1f}  (spread: {max(new_clarities)-min(new_clarities):.1f} pts)")
        p(f"- Std: {np.std(new_clarities):.2f}")
        p(f"- p5={np.percentile(new_clarities,5):.1f}  p25={np.percentile(new_clarities,25):.1f}  median={np.median(new_clarities):.1f}  p75={np.percentile(new_clarities,75):.1f}  p95={np.percentile(new_clarities,95):.1f}")
        p()

    # Check the three targets
    p("### Target Gate Checks")
    p()
    targets_pass = True
    for idx, old, new, desc in step4_rows:
        if idx == 1:
            passed = new["clarity_score"] is None
            p(f"- **Image #1** (36KB dark): UNSCOREABLE? {'✅ YES' if passed else f'❌ NO — scored {new[\"clarity_score\"]}'}")
            if not passed: targets_pass = False
        if idx == 5:
            passed = new["clarity_score"] is not None and new["clarity_score"] > 70
            p(f"- **Image #5** (1901KB 4K clear): clarity > 70? {'✅ YES — ' + str(new['clarity_score']) if passed else f'❌ NO — {new[\"clarity_score\"]}'}")
            if not passed: targets_pass = False
        if idx == 11:
            passed = new["clarity_score"] is not None and new["clarity_score"] < 40
            p(f"- **Image #11** (47KB high DCP): clarity < 40? {'✅ YES — ' + str(new['clarity_score']) if passed else f'❌ NO — {new[\"clarity_score\"]}'}")
            if not passed: targets_pass = False

    p()
    if targets_pass:
        p("**All three targets passed. Proceeding to Step 5.**")
    else:
        p("**⚠️ TARGET GATE FAILED. Review required before Step 5.**")
    p()

    if not targets_pass:
        # Write what we have and stop
        with open(OUT_PATH, "w") as f:
            f.write("\n".join(lines))
        print(f"Target gate FAILED. Wrote partial report to {OUT_PATH}")
        return False

    # ── Step 5: 50-image full validation ──────────────────────────────────────
    p("---")
    p("## Step 5: 50-Image Full Validation")
    p()
    p("Sampling strategy: stratified by camera type, rng seed=137 (different from calibration seed=42).")
    p()

    images_50 = gather_step5(50)
    results_50 = []
    unscore_list = []

    for path in images_50:
        r = score_image(path)
        name = os.path.basename(path)
        if r["clarity_score"] is None:
            unscore_list.append((name, r["unscoreable_reason"]))
        else:
            results_50.append(r)

    clarities = np.array([r["clarity_score"] for r in results_50])
    dcps  = np.array([r["metrics_score"]["dcp_score"]       for r in results_50])
    tens  = np.array([r["metrics_score"]["tenengrad_score"]  for r in results_50])
    bds   = np.array([r["metrics_score"]["blue_dom_score"]   for r in results_50])
    uicms = np.array([r["metrics_score"]["uicm_score"]       for r in results_50])

    p(f"**n total:** {len(images_50)}  |  **n scoreable:** {len(results_50)}  |  **n unscoreable:** {len(unscore_list)}")
    p()

    if unscore_list:
        p("### Unscoreable Images")
        p()
        for name, reason in unscore_list:
            p(f"- `{name}`: {reason}")
        p()

    p("### Clarity Score Distribution")
    p()
    p(f"- **Range:** {clarities.min():.1f} – {clarities.max():.1f}  (spread: {clarities.max()-clarities.min():.1f} pts)")
    p(f"- **Std:** {clarities.std():.2f}")
    p(f"- p5={np.percentile(clarities,5):.1f}  p25={np.percentile(clarities,25):.1f}  median={np.median(clarities):.1f}  p75={np.percentile(clarities,75):.1f}  p95={np.percentile(clarities,95):.1f}")
    p()

    # ASCII histogram
    p("### Score Histogram (clarity)")
    p()
    p("```")
    bins = [(i*10, (i+1)*10) for i in range(10)]
    for lo, hi in bins:
        count = int(((clarities >= lo) & (clarities < hi)).sum())
        bar   = "█" * count
        p(f"  {lo:3d}–{hi:3d} | {bar:<30} {count}")
    p("```")
    p()

    # Per-metric distribution
    p("### Per-Metric Score Distribution (all turbidity, 0=clear end, 100=turbid end)")
    p()
    p("| Metric | min | p25 | median | p75 | max | std |")
    p("|--------|-----|-----|--------|-----|-----|-----|")
    for name, arr in [("dcp_score", dcps), ("tenengrad_score", tens), ("blue_dom_score", bds), ("uicm_score", uicms)]:
        p(f"| {name} | {arr.min():.1f} | {np.percentile(arr,25):.1f} | {np.median(arr):.1f} | {np.percentile(arr,75):.1f} | {arr.max():.1f} | {arr.std():.1f} |")
    p()

    # Top 5 highest clarity
    sorted_by_clarity = sorted(results_50, key=lambda r: r["clarity_score"], reverse=True)
    p("### Top 5 Highest Clarity (should look visibly clear)")
    p()
    p("| Image | Clarity | DCP_s | Ten_s | BD_s | UICM_s |")
    p("|-------|---------|-------|-------|------|--------|")
    for r in sorted_by_clarity[:5]:
        n = os.path.basename(r["path"])[:40]
        ms = r["metrics_score"]
        p(f"| `{n}` | **{r['clarity_score']:.1f}** | {ms['dcp_score']:.0f} | {ms['tenengrad_score']:.0f} | {ms['blue_dom_score']:.0f} | {ms['uicm_score']:.0f} |")
    p()

    # Top 5 lowest clarity
    p("### Top 5 Lowest Clarity (should look visibly muddy)")
    p()
    p("| Image | Clarity | DCP_s | Ten_s | BD_s | UICM_s |")
    p("|-------|---------|-------|-------|------|--------|")
    for r in sorted_by_clarity[-5:]:
        n = os.path.basename(r["path"])[:40]
        ms = r["metrics_score"]
        p(f"| `{n}` | **{r['clarity_score']:.1f}** | {ms['dcp_score']:.0f} | {ms['tenengrad_score']:.0f} | {ms['blue_dom_score']:.0f} | {ms['uicm_score']:.0f} |")
    p()

    # Top 5 most uncertain (metrics disagree most)
    def disagreement(r):
        scores = list(r["metrics_score"].values())
        return float(np.std(scores))
    results_sorted_disagree = sorted(results_50, key=disagreement, reverse=True)
    p("### Top 5 Most Uncertain (metrics disagree heavily)")
    p()
    p("| Image | Clarity | DCP_s | Ten_s | BD_s | UICM_s | MetricStd |")
    p("|-------|---------|-------|-------|------|--------|-----------|")
    for r in results_sorted_disagree[:5]:
        n  = os.path.basename(r["path"])[:38]
        ms = r["metrics_score"]
        sd = disagreement(r)
        p(f"| `{n}` | {r['clarity_score']:.1f} | {ms['dcp_score']:.0f} | {ms['tenengrad_score']:.0f} | {ms['blue_dom_score']:.0f} | {ms['uicm_score']:.0f} | {sd:.1f} |")
    p()

    # Honest assessment
    p("---")
    p("## Step 6: Honest Assessment")
    p()
    spread = float(clarities.max() - clarities.min())
    std    = float(clarities.std())
    p(f"**Score spread:** {spread:.1f} pts  |  **Std:** {std:.2f}")
    p()
    if spread >= 40 and std >= 12:
        p("The fixed scorer produces a substantially wider distribution than the original (10.9 pts).")
        p(f"A {spread:.0f}-point spread with std={std:.1f} is sufficient for a downstream regressor to learn from label variance.")
    elif spread >= 25:
        p(f"Improvement over original (10.9 pts): the fixed scorer spans {spread:.0f} pts. This is useful but not ideal.")
        p("Partial calibration improvement expected once more manually-verified labels are available.")
    else:
        p(f"⚠️ **Score spread is still narrow ({spread:.0f} pts).** The fixes reduced but did not eliminate the clustering problem.")
        p("Proceed to Section 9 open questions before relying on these labels for regression training.")

    p()
    p("### Remaining Open Questions (from plan-scan.md Section 9)")
    p()
    p("- **Q2 (YOLO labels):** The data/*/labels/ files are YOLO object-detection annotations. They are NOT visibility scores. Do not conflate these with the clarity labels produced by scorer.py.")
    p("- **Q5 (Timestamp coverage):** No FeatureRow CSV for historical dates has been verified. Before joining image labels to weather features, confirm that backend API calls have been made (or can be made historically) for the same timestamps as the images.")
    p("- **Q6 (Multiple cameras per timestamp):** Several timestamps have simultaneous IPC608 + C4k0193 images. Current scorer does not aggregate across cameras. Decision needed: average per timestamp, or train per-camera model.")
    p("- **Q7 (Human ground truth):** Calibration bounds (p5/p95) were set from the data distribution, not from human-verified clarity labels. The scorer could be systematically wrong in direction for this specific dataset. Manual ranking of 10-20 images is strongly recommended before trusting the labels.")
    p()
    p("### What to Do Next")
    p()
    p("1. Visually inspect the Top 5 highest and lowest clarity images listed above.")
    p("2. If the direction is correct (high clarity = visually clear), proceed to Fix 8 (batch scoring all 3,568 images).")
    p("3. If the direction is wrong, invert the Blue Dominance and/or UICM metrics' `_INVERT` flag in scorer.py and re-run calibration.")
    p("4. After batch scoring, join to FeatureRow CSVs (Q5 must be resolved first).")

    with open(OUT_PATH, "w") as f:
        f.write("\n".join(lines))
    print(f"\nWrote {OUT_PATH}")
    return True

if __name__ == "__main__":
    run_all()
