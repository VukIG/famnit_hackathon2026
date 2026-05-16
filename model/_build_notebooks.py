"""
Builds model/main.ipynb (5 cells) and model/experiments.ipynb (dead code).
Run once after scorer.py / calibration work is complete.
"""
import json
import os

BASE = r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model"


def cell(cell_type, source, outputs=None):
    if cell_type == "code":
        return {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": outputs or [],
            "source": source if isinstance(source, list) else [source],
        }
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": source if isinstance(source, list) else [source],
    }


def notebook(cells, kernel="python3"):
    return {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": kernel,
            },
            "language_info": {"name": "python", "version": "3.11.0"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }


# ── Cell sources for main.ipynb ────────────────────────────────────────────────

CELL0_IMPORTS = """\
import numpy as np
import pandas as pd
import cv2
from PIL import Image
import glob
import csv
import datetime
import re
import os
import sys

sys.path.insert(0, os.path.abspath("."))
from scorer import (
    score_image, reload_calibration, is_scoreable, load_image,
    dark_channel_score, tenengrad_sharpness, blue_dominance,
    uicm_normalized, preprocess_for_metrics, CALIBRATION_PATH,
)

BASE_DATA = os.path.join(os.path.abspath("."), "data")
print("scorer loaded, calibration:", CALIBRATION_PATH)
"""

CELL1_CALIBRATION = """\
# Calibrate: sample 50 images stratified by camera type, write calibration.json.
# Skip this cell if calibration.json already exists and you have not changed the dataset.
import subprocess, sys

result = subprocess.run(
    [sys.executable, os.path.join(os.path.abspath("."), "_calibrate.py")],
    capture_output=True, text=True,
)
print(result.stdout[-4000:] if len(result.stdout) > 4000 else result.stdout)
if result.returncode != 0:
    print("CALIBRATION FAILED\\n", result.stderr[-1000:])
else:
    reload_calibration()
    print("\\nCalibration reloaded from:", CALIBRATION_PATH)
"""

CELL2_VALIDATION_15 = """\
# 15-image validation — same images used in plan-scan.md Section 6a.
# Shows current NEW scorer output; OLD scores are in plan-scan-fix-validation.md.
FIFTEEN = [
    (1,  "data/train/images/20231016-173101-IPC608_8B64_165.jpg"),
    (2,  "data/train/images/20231002-055401-IPC608_8B64_165.jpg"),
    (3,  "data/train/images/20231018-105601-IPC608_8B64_165.jpg"),
    (4,  "data/train/images/20240401-141501-AIPC608UW_10_167.jpg"),
    (5,  "data/train/images/20230404-120000-C4k0193.jpg"),
    (6,  "data/valid/images/20231202-142401-IPC608_8B64_165.jpg"),
    (7,  "data/valid/images/20231001-102401-IPC608_8B64_165.jpg"),
    (8,  "data/valid/images/20240411-121901-IPC608_8B64_165.jpg"),
    (9,  "data/valid/images/20240505-160901-IPC608_8BC7_166.jpg"),
    (10, "data/valid/images/20230404-160000-C4k0193.jpg"),
    (11, "data/test/images/20240229-132001-IPC608_8B64_165.jpg"),
    (12, "data/test/images/20240306-Video-2-IPC608_8B64_166_frame087.jpg"),
    (13, "data/test/images/20231007-090201-IPC608_8B64_165.jpg"),
    (14, "data/test/images/20240410-120800-Video-AIPC608UW_10_167_frame010.jpg"),
    (15, "data/test/images/20230325-180000-C4k0193.jpg"),
]

OLD_SCORES = {
    1: 54.4, 2: 58.1, 3: 61.1, 4: 56.5, 5: 56.9,
    6: 64.5, 7: 61.9, 8: 63.0, 9: 57.0, 10: 56.6,
    11: 65.2, 12: 62.1, 13: 59.9, 14: 57.1, 15: 54.2,
}

print(f"{'#':>2}  {'File':<55}  {'OLD':>6}  {'NEW':>6}  {'Delta':>7}  Unscoreable?")
print("-" * 100)
clarities = []
for idx, rel_path in FIFTEEN:
    path = os.path.join(os.path.abspath("."), rel_path)
    r = score_image(path)
    old = OLD_SCORES[idx]
    new_c = r["clarity_score"]
    fname = os.path.basename(path)[:54]
    if new_c is None:
        delta_str = "  —"
        new_str = "UNSCOREABLE"
        unscore = r["unscoreable_reason"] or ""
    else:
        delta_str = f"{new_c - old:+7.1f}"
        new_str = f"{new_c:6.1f}"
        unscore = ""
        clarities.append(new_c)
    print(f"{idx:2d}  {fname:<55}  {old:6.1f}  {new_str:>11}  {delta_str}  {unscore}")

if clarities:
    print(f"\\nNEW clarity — n={len(clarities)}  range={min(clarities):.1f}–{max(clarities):.1f}"
          f"  spread={max(clarities)-min(clarities):.1f}  std={np.std(clarities):.2f}")
"""

CELL3_VALIDATION_50 = """\
# 50-image full validation — stratified by camera, seed=137 (differs from calibration seed=42).
CAMERAS = ["IPC608_8B64_165", "IPC608_8BC7_166", "AIPC608UW_10_167", "C4k0193"]

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

rng = np.random.default_rng(137)
selected = []
n_per_bucket = 50 // len(CAMERAS)
for cam in CAMERAS:
    pool = sorted(buckets[cam])
    n = min(n_per_bucket, len(pool))
    idx = rng.choice(len(pool), size=n, replace=False)
    selected += [pool[i] for i in sorted(idx)]
remaining = 50 - len(selected)
if remaining > 0 and other:
    pool = sorted(other)
    n = min(remaining, len(pool))
    idx = rng.choice(len(pool), size=n, replace=False)
    selected += [pool[i] for i in sorted(idx)]

results = []
for path in selected:
    r = score_image(path)
    r["path"] = path
    results.append(r)

scored = [r for r in results if r["clarity_score"] is not None]
unscored = [r for r in results if r["clarity_score"] is None]
clarities = [r["clarity_score"] for r in scored]

print(f"n_total={len(results)}  n_scored={len(scored)}  n_unscored={len(unscored)}")
if clarities:
    arr = np.array(clarities)
    print(f"range={arr.min():.1f}–{arr.max():.1f}  spread={arr.max()-arr.min():.1f}"
          f"  std={arr.std():.2f}")
    pcts = np.percentile(arr, [5, 25, 50, 75, 95])
    print(f"p5={pcts[0]:.1f}  p25={pcts[1]:.1f}  median={pcts[2]:.1f}"
          f"  p75={pcts[3]:.1f}  p95={pcts[4]:.1f}")
    print()
    bins = range(0, 101, 10)
    for lo in range(0, 100, 10):
        hi = lo + 10
        count = sum(1 for c in clarities if lo <= c < hi)
        bar = "█" * count
        print(f"  {lo:3d}–{hi:3d} | {bar:<30} {count}")
"""

CELL4_BATCH_SCORER = """\
# Fix 8 — Batch scorer: score all images and write labels/visibility_scores.csv.
# Run once; re-run after re-calibrating.
import csv

LABEL_DIR = os.path.join(os.path.abspath("."), "labels")
os.makedirs(LABEL_DIR, exist_ok=True)
OUT_CSV = os.path.join(LABEL_DIR, "visibility_scores.csv")

all_images = []
for split in ("train", "valid", "test"):
    all_images += sorted(glob.glob(os.path.join(BASE_DATA, split, "images", "*.jpg")))

print(f"Scoring {len(all_images)} images → {OUT_CSV}")

with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "image_path", "split", "filename", "timestamp",
        "clarity_score", "turbidity_score", "unscoreable_reason",
        "dcp_raw", "tenengrad_raw", "blue_dom_raw", "uicm_raw",
        "dcp_score", "tenengrad_score", "blue_dom_score", "uicm_score",
        "image_w", "image_h",
    ])
    n_scored = n_unscored = 0
    for path in all_images:
        split = path.split(os.sep)[-3]  # train / valid / test
        fname = os.path.basename(path)
        # Extract timestamp from filename: YYYYMMDD-HHMMSS prefix
        m = re.match(r"(\\d{8}-\\d{6})", fname)
        ts = m.group(1) if m else ""
        r = score_image(path)
        raw = r.get("metrics_raw", {})
        scr = r.get("metrics_score", {})
        writer.writerow([
            path, split, fname, ts,
            r["clarity_score"], r["turbidity_score"], r["unscoreable_reason"],
            raw.get("dcp"), raw.get("tenengrad"), raw.get("blue_dom"), raw.get("uicm"),
            scr.get("dcp_score"), scr.get("tenengrad_score"),
            scr.get("blue_dom_score"), scr.get("uicm_score"),
            r["image_w"], r["image_h"],
        ])
        if r["clarity_score"] is not None:
            n_scored += 1
        else:
            n_unscored += 1

print(f"Done. scored={n_scored}  unscored={n_unscored}")
print(f"CSV written: {OUT_CSV}")

df = pd.read_csv(OUT_CSV)
scored_df = df[df["clarity_score"].notna()]
if len(scored_df):
    arr = scored_df["clarity_score"].values
    print(f"\\nFull dataset clarity — n={len(arr)}  range={arr.min():.1f}–{arr.max():.1f}"
          f"  std={arr.std():.2f}  median={np.median(arr):.1f}")
"""


# ── Cell sources for experiments.ipynb (dead code) ────────────────────────────

EXP_CELL0 = """\
# Copernicus Marine — Indian Ocean currents download.
# Not related to the Yousee Piran visibility scorer. Archived for reference.
import numpy as np
import pandas as pd
import copernicusmarine
"""

EXP_CELL1 = """\
dataset = copernicusmarine.subset(
  dataset_id="cmems_mod_glo_phy_my_0.083deg_P1D-m",
  variables=["uo", "vo"],
  minimum_longitude=50,
  maximum_longitude=90,
  minimum_latitude=0,
  maximum_latitude=25,
  start_datetime="2020-01-01",
  end_datetime="2020-01-31",
  minimum_depth=0,
  maximum_depth=30,
  output_filename = "Indian_currents_Jan2020.nc",
  output_directory = "copernicus-data"
)
"""

EXP_CELL2 = """\
import os
import shutil

# Define your source directory and your destination directory
search_directory = "/home/momir19/famnit_hackathon2026/model/23sp_4120img_34945annots_2688res"
destination_directory = "/home/momir19/famnit_hackathon2026/model/copied_images"

# Target substring you are searching for
target_string = "IPC608_8B64_165.jpg"

# Create the destination folder automatically if it doesn't exist yet
os.makedirs(destination_directory, exist_ok=True)

print("Starting file separation process...")
print(f"Target substring: '{target_string}'\\n" + "-"*50)

copied_count = 0
ignored_count = 0

for root, dirs, files in os.walk(search_directory):
    for filename in files:
        if target_string in filename:
            source_path = os.path.join(root, filename)
            shutil.copy2(source_path, destination_directory)
            copied_count += 1
        else:
            ignored_count += 1

print(f"\\nCopied: {copied_count} files")
print(f"Ignored: {ignored_count} files")
"""

EXP_CELL3 = """\
import cv2

def extract_corner_text(image_path, crop_percentage=0.20):
    \"\"\"
    Crops the top-right and bottom-left corners of an image
    and uses EasyOCR to extract time, date, or metadata labels.
    \"\"\"
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not read image from {image_path}")
        return None, None

    h, w, _ = img.shape
    crop_h = int(h * crop_percentage)
    crop_w = int(w * crop_percentage)

    top_right_corner = img[0:crop_h, w - crop_w:w]
    bottom_left_corner = img[h - crop_h:h, 0:crop_w]

    import easyocr
    reader = easyocr.Reader(['en'])
    top_right_text = reader.readtext(top_right_corner, detail=0)
    bottom_left_text = reader.readtext(bottom_left_corner, detail=0)

    return top_right_text, bottom_left_text
"""

EXP_CELL4 = """\
from roboflow import Roboflow

# 1. Initialize the Roboflow client with your private API key
rf = Roboflow(api_key="YOUR_PRIVATE_API_KEY")

# 2. Reference your workspace and project details
workspace_name = "lukas-workspace-3ubeb"
project_name = "picking-cotton"
project = rf.workspace(workspace_name).project(project_name)

# 3. Set your data path
dataset_path = "/path/to/data"

# 4. Execute the upload sequentially
import os
if os.path.isdir(dataset_path):
    for filename in sorted(os.listdir(dataset_path)):
        file_path = os.path.join(dataset_path, filename)
        project.upload(file_path)
        print(f"Uploaded: {filename}")
else:
    project.upload(dataset_path)
    print(f"Uploaded: {dataset_path}")
"""


def build_main_nb():
    cells = [
        cell("markdown", "# Yousee Piran — Underwater Visibility Scorer\n\nMain pipeline: calibrate → validate → batch score all images."),
        cell("code", CELL0_IMPORTS),
        cell("markdown", "## Cell 1 — Calibration\n\nSamples 50 images stratified by camera type; writes `calibration.json`."),
        cell("code", CELL1_CALIBRATION),
        cell("markdown", "## Cell 2 — 15-Image Validation\n\nCompares new scorer against old turbidity baseline (old scores from `plan-scan-fix-validation.md`)."),
        cell("code", CELL2_VALIDATION_15),
        cell("markdown", "## Cell 3 — 50-Image Full Validation\n\nStratified sample (seed=137, different from calibration seed=42)."),
        cell("code", CELL3_VALIDATION_50),
        cell("markdown", "## Cell 4 — Batch Scorer (Fix 8)\n\nScores all images; writes `labels/visibility_scores.csv`."),
        cell("code", CELL4_BATCH_SCORER),
    ]
    return notebook(cells)


def build_experiments_nb():
    cells = [
        cell("markdown", "# Experiments Archive\n\nDead code from original `main.ipynb` Cells 0–4. Kept for reference; not part of the scoring pipeline."),
        cell("markdown", "## Copernicus Marine — Indian Ocean currents (unrelated to scorer)"),
        cell("code", EXP_CELL0),
        cell("code", EXP_CELL1),
        cell("markdown", "## Linux file copy — extract IPC608 images on remote server"),
        cell("code", EXP_CELL2),
        cell("markdown", "## EasyOCR — extract camera overlay text from corners"),
        cell("code", EXP_CELL3),
        cell("markdown", "## Roboflow upload (placeholder API key)"),
        cell("code", EXP_CELL4),
    ]
    return notebook(cells)


if __name__ == "__main__":
    main_path = os.path.join(BASE, "main.ipynb")
    exp_path  = os.path.join(BASE, "experiments.ipynb")

    with open(main_path, "w", encoding="utf-8") as f:
        json.dump(build_main_nb(), f, indent=1, ensure_ascii=False)
    print(f"Wrote {main_path}")

    with open(exp_path, "w", encoding="utf-8") as f:
        json.dump(build_experiments_nb(), f, indent=1, ensure_ascii=False)
    print(f"Wrote {exp_path}")
