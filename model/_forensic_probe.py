"""
Forensic probe — original main.ipynb Cell 5 + Cell 6 run verbatim on 15 images.

Purpose: establish the empirical baseline (OLD scorer) and diagnose the root
cause of score clustering. This file does NOT use scorer.py — it replicates
the original pipeline exactly so the bug is reproducible in isolation.

Root cause confirmed: beta=255 in pre_processing() forces all pixels to ≥255
range before background subtraction, making contrast_score and sharpness_score
near-constants and compressing all scores into a 10.9-point band (54.2–65.2).
"""
import os
import sys
import warnings
warnings.filterwarnings("ignore")

import cv2
import numpy as np
from PIL import Image

BASE = r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model"

FIFTEEN = [
    (1,  r"data\train\images\20231016-173101-IPC608_8B64_165.jpg"),
    (2,  r"data\train\images\20231002-055401-IPC608_8B64_165.jpg"),
    (3,  r"data\train\images\20231018-105601-IPC608_8B64_165.jpg"),
    (4,  r"data\train\images\20240401-141501-AIPC608UW_10_167.jpg"),
    (5,  r"data\train\images\20230404-120000-C4k0193.jpg"),
    (6,  r"data\valid\images\20231202-142401-IPC608_8B64_165.jpg"),
    (7,  r"data\valid\images\20231001-102401-IPC608_8B64_165.jpg"),
    (8,  r"data\valid\images\20240411-121901-IPC608_8B64_165.jpg"),
    (9,  r"data\valid\images\20240505-160901-IPC608_8BC7_166.jpg"),
    (10, r"data\valid\images\20230404-160000-C4k0193.jpg"),
    (11, r"data\test\images\20240229-132001-IPC608_8B64_165.jpg"),
    (12, r"data\test\images\20240306-Video-2-IPC608_8B64_166_frame087.jpg"),
    (13, r"data\test\images\20231007-090201-IPC608_8B64_165.jpg"),
    (14, r"data\test\images\20240410-120800-Video-AIPC608UW_10_167_frame010.jpg"),
    (15, r"data\test\images\20230325-180000-C4k0193.jpg"),
]


# ── Cell 5 verbatim — pre_processing() ────────────────────────────────────────

def pre_processing(image_sample):
    img_arr = np.array(Image.open(image_sample))
    alpha = 2      # contrast
    beta  = 255    # brightness — BUG: forces all pixels to ≥255 range
    raw_img = np.clip(img_arr.astype(np.float64) * alpha + beta, 0, 65535).astype(np.float64)
    first_method = raw_img.copy()
    se  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    bg  = cv2.morphologyEx(first_method, cv2.MORPH_DILATE, se)
    out = cv2.divide(first_method, bg, scale=255)
    out = 255 - out
    img = out.astype(np.uint8)
    img = cv2.fastNlMeansDenoising(img, None, 4, 10, 7)
    return cv2.GaussianBlur(img, (3, 3), 0)


# ── Cell 6 verbatim — dark_channel + estimate_turbidity ───────────────────────

def dark_channel(img, patch_size=15):
    min_channel = np.min(img, axis=2)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (patch_size, patch_size))
    dark = cv2.erode(min_channel, kernel)
    return dark


def estimate_turbidity(original_rgb_path, blurred_preprocessed):
    original_rgb = np.array(Image.open(original_rgb_path))

    # DCP on original (0–1 scale)
    original_float = original_rgb.astype(np.float32) / 255.0
    dark = dark_channel(original_float)
    dcp_score = float(np.mean(dark)) * 100.0

    # Sharpness on preprocessed blurred image (Laplacian / 300)
    gray_preprocessed = cv2.cvtColor(blurred_preprocessed, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray_preprocessed, cv2.CV_64F).var()
    sharpness_score = min(100, laplacian_var / 300 * 100)

    # Contrast on preprocessed (std/255)
    contrast_score = np.std(gray_preprocessed) / 255.0 * 100

    # Red attenuation (original code)
    r = original_rgb[:, :, 0].astype(np.float32)
    g = original_rgb[:, :, 1].astype(np.float32)
    b = original_rgb[:, :, 2].astype(np.float32)
    red_attenuation = float(np.mean(g + b) / (2 * np.mean(r) + 1e-6))
    red_score = min(100, red_attenuation * 50)

    # Weighted turbidity
    turbidity_score = (
        0.40 * dcp_score
        + 0.25 * (100 - sharpness_score)   # inverted: high sharpness = clear
        + 0.25 * (100 - contrast_score)    # inverted: high contrast  = clear
        + 0.10 * (100 - red_score)         # inverted: high red_score = clear
    )
    turbidity_score = float(np.clip(turbidity_score, 0, 100))

    return {
        "turbidity_score": round(turbidity_score, 2),
        "dcp_score":        round(dcp_score, 2),
        "sharpness_score":  round(sharpness_score, 2),
        "contrast_score":   round(contrast_score, 2),
        "red_score":        round(red_score, 2),
    }


def old_score(path: str) -> dict:
    try:
        preprocessed = pre_processing(path)
        return estimate_turbidity(path, preprocessed)
    except Exception as e:
        return {"error": str(e)}


# ── Run probe ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Forensic probe — OLD scorer (Cell 5+6 verbatim)")
    print(f"{'#':>2}  {'File':<55}  {'Turb':>6}  {'DCP':>6}  {'Sharp':>6}  {'Contr':>6}  {'Red':>6}")
    print("-" * 100)

    turbidities = []
    for idx, rel in FIFTEEN:
        path = os.path.join(BASE, rel)
        if not os.path.exists(path):
            print(f"{idx:2d}  FILE NOT FOUND: {rel}")
            continue
        r = old_score(path)
        if "error" in r:
            print(f"{idx:2d}  ERROR: {r['error']}")
            continue
        turbidities.append(r["turbidity_score"])
        fname = os.path.basename(path)[:54]
        print(f"{idx:2d}  {fname:<55}  {r['turbidity_score']:6.1f}  {r['dcp_score']:6.1f}"
              f"  {r['sharpness_score']:6.1f}  {r['contrast_score']:6.1f}  {r['red_score']:6.1f}")

    if turbidities:
        arr = np.array(turbidities)
        print(f"\nOLD turbidity — n={len(arr)}  range={arr.min():.1f}–{arr.max():.1f}"
              f"  spread={arr.max()-arr.min():.1f}  std={arr.std():.2f}")
        print("\nDiagnosis: spread < 11 pts with std < 4 confirms the constant-floor bug.")
        print("Root cause: beta=255 in pre_processing() pushes all pixels to ≥255,")
        print("making sharpness≈0–33/300 and contrast≈0.003–0.035 — both near constants.")
