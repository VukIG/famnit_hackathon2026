"""
Calibration script — Step 3 of plan-scan fix pass.
Samples 50 images stratified by camera type, computes p5/p95 for each
raw metric, writes model/calibration.json.

Strategy: stratified by camera suffix (4 types) to avoid one camera dominating.
"""
import glob
import json
import os
import sys
import warnings
warnings.filterwarnings("ignore")

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from scorer import load_image, is_scoreable, preprocess_for_metrics
from scorer import _dark_channel_raw, tenengrad_sharpness, blue_dominance, uicm_normalized
from scorer import CALIBRATION_PATH

BASE = r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model\data"

# Camera identifiers for stratification
CAMERAS = [
    "IPC608_8B64_165",
    "IPC608_8BC7_166",
    "AIPC608UW_10_167",
    "C4k0193",
]


def gather_stratified(n_total=50):
    all_images = []
    for split in ("train", "valid", "test"):
        all_images += glob.glob(os.path.join(BASE, split, "images", "*.jpg"))

    # Bucket by camera type
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

    # Sample proportionally, rng seed for reproducibility
    rng = np.random.default_rng(42)
    selected = []
    n_per_bucket = n_total // len(CAMERAS)
    for cam in CAMERAS:
        pool = sorted(buckets[cam])
        n = min(n_per_bucket, len(pool))
        idx = rng.choice(len(pool), size=n, replace=False)
        selected += [pool[i] for i in sorted(idx)]
    # Fill remainder from 'other' or largest bucket
    remaining = n_total - len(selected)
    if remaining > 0 and other:
        pool = sorted(other)
        n = min(remaining, len(pool))
        idx = rng.choice(len(pool), size=n, replace=False)
        selected += [pool[i] for i in sorted(idx)]

    return selected


def main():
    images = gather_stratified(50)
    print(f"Selected {len(images)} images for calibration (stratified by camera type)")

    records = []
    skipped = []

    for path in images:
        try:
            img = load_image(path)
        except ValueError as e:
            skipped.append((path, str(e)))
            continue

        ok, reason = is_scoreable(img)
        if not ok:
            skipped.append((path, reason))
            continue

        views = preprocess_for_metrics(img)
        dcp_raw  = _dark_channel_raw(views["full_rgb"])
        ten_res  = tenengrad_sharpness(views["crop_rgb"])
        bd_res   = blue_dominance(views["crop_rgb"])
        uicm_res = uicm_normalized(views["crop_rgb"])

        records.append({
            "path":      path,
            "dcp":       dcp_raw,
            "tenengrad": ten_res["raw"],
            "blue_dom":  bd_res["raw"],
            "uicm":      uicm_res["raw"],
        })
        cam = next((c for c in CAMERAS if c in os.path.basename(path)), "other")
        print(f"  OK  {os.path.basename(path)[:45]:<45}  cam={cam}  dcp={dcp_raw:.1f}  ten={ten_res['raw']:.0f}  bd={bd_res['raw']:.3f}  uicm={uicm_res['raw']:.4f}")

    print(f"\nSkipped {len(skipped)} images:")
    for p, r in skipped:
        print(f"  SKIP {os.path.basename(p)}: {r}")

    if len(records) < 10:
        print("\nERROR: too few scoreable images for calibration. Aborting.")
        sys.exit(1)

    dcps       = np.array([r["dcp"]       for r in records])
    tenegrads  = np.array([r["tenengrad"] for r in records])
    blue_doms  = np.array([r["blue_dom"]  for r in records])
    uicms      = np.array([r["uicm"]      for r in records])

    def stats(name, arr):
        print(f"  {name:<12}: min={arr.min():.4f}  p5={np.percentile(arr,5):.4f}  "
              f"p25={np.percentile(arr,25):.4f}  med={np.median(arr):.4f}  "
              f"p75={np.percentile(arr,75):.4f}  p95={np.percentile(arr,95):.4f}  "
              f"max={arr.max():.4f}  std={arr.std():.4f}")

    print(f"\nDistribution stats (n={len(records)} scoreable):")
    stats("dcp",       dcps)
    stats("tenengrad", tenegrads)
    stats("blue_dom",  blue_doms)
    stats("uicm",      uicms)

    cal = {
        "dcp":       {"low": round(float(np.percentile(dcps,      5)), 4),
                      "high": round(float(np.percentile(dcps,     95)), 4)},
        "tenengrad": {"low": round(float(np.percentile(tenegrads, 5)), 4),
                      "high": round(float(np.percentile(tenegrads,95)), 4)},
        "blue_dom":  {"low": round(float(np.percentile(blue_doms, 5)), 4),
                      "high": round(float(np.percentile(blue_doms,95)), 4)},
        "uicm":      {"low": round(float(np.percentile(uicms,     5)), 4),
                      "high": round(float(np.percentile(uicms,    95)), 4)},
        "_meta": {
            "n_images": len(records),
            "n_skipped": len(skipped),
            "strategy": "stratified by camera type, rng seed=42",
        }
    }

    with open(CALIBRATION_PATH, "w") as f:
        json.dump(cal, f, indent=2)
    print(f"\nWrote {CALIBRATION_PATH}")
    print(json.dumps({k: v for k, v in cal.items() if not k.startswith("_")}, indent=2))


if __name__ == "__main__":
    main()
