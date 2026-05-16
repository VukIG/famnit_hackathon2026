"""
scorer.py — Underwater visibility scorer for Yousee Piran.

Implements Fixes 1-7 from plan-scan.md (2026-05-16).
Outputs clarity_score: 0=muddy, 100=clear.

Calibration bounds are read from calibration.json (same directory) at import
time. If the file is absent, plan-scan Section 4 empirical defaults are used
and a warning is printed. Run the calibration cell in main.ipynb to produce
calibration.json from your actual dataset.
"""

import json
import os
import warnings

import cv2
import numpy as np
from PIL import Image

# ── Calibration ────────────────────────────────────────────────────────────────

_DIR = os.path.dirname(os.path.abspath(__file__))
CALIBRATION_PATH = os.path.join(_DIR, "calibration.json")

# Plan-scan Section 4 empirical defaults (n=15, conservative).
# DCP:       higher raw = more turbid.  Observed 1.6–48.5; use tighter defaults.
# Tenengrad: higher raw = sharper = clearer (invert=True).
# BlueDom:   higher raw = more blue = clearer (invert=True).
# UICM:      higher raw = more colorful = clearer (invert=True).
_DEFAULTS: dict = {
    "dcp":       {"low": 2.0,   "high": 50.0},
    "tenengrad": {"low": 20.0,  "high": 3000.0},
    "blue_dom":  {"low": 0.6,   "high": 3.5},
    "uicm":      {"low": -0.10, "high": 0.40},
}

# Invert flags — these are metric properties, not calibration data.
_INVERT = {
    "dcp":       False,  # high DCP = turbid → score goes up
    "tenengrad": True,   # high Tenengrad = clear → invert
    "blue_dom":  True,   # high B/R = clear → invert
    "uicm":      True,   # high UICM = colorful/clear → invert
}


def _load_calibration() -> dict:
    if os.path.exists(CALIBRATION_PATH):
        try:
            with open(CALIBRATION_PATH) as f:
                data = json.load(f)
            # Merge with defaults to handle missing keys gracefully
            merged = _DEFAULTS.copy()
            merged.update(data)
            return merged
        except Exception as e:
            warnings.warn(f"scorer: could not read {CALIBRATION_PATH}: {e}. Using defaults.")
    else:
        warnings.warn(
            "scorer: calibration.json not found — using plan-scan defaults. "
            "Run the calibration cell in main.ipynb to improve accuracy.",
            stacklevel=2,
        )
    return _DEFAULTS.copy()


_CAL = _load_calibration()


def reload_calibration() -> dict:
    """Call after writing a new calibration.json to hot-reload bounds."""
    global _CAL
    _CAL = _load_calibration()
    return _CAL


def _to_turbidity(raw: float, metric: str) -> float:
    """Maps raw metric value to turbidity in [0, 100] using calibrated bounds."""
    low = _CAL[metric]["low"]
    high = _CAL[metric]["high"]
    if high == low:
        return 50.0
    normalized = float(np.clip((raw - low) / (high - low), 0.0, 1.0))
    if _INVERT[metric]:
        normalized = 1.0 - normalized
    return round(normalized * 100.0, 2)


# ── Image loading ──────────────────────────────────────────────────────────────

def load_image(path: str) -> np.ndarray:
    """
    Load image from path and return RGB uint8 ndarray.

    Handles:
    - 16-bit images: normalized to 8-bit.
    - RGBA: alpha channel dropped.
    - Grayscale (mode L): converted to 3-channel RGB.

    Raises ValueError on unreadable files, all-zero images, or images
    smaller than 200×200 (Fix 1.1).
    """
    try:
        pil_img = Image.open(path)
    except Exception as e:
        raise ValueError(f"Cannot open image {path}: {e}") from e

    mode = pil_img.mode
    if mode == "RGBA":
        pil_img = pil_img.convert("RGB")
    elif mode == "L":
        pil_img = pil_img.convert("RGB")
    elif mode not in ("RGB", "I", "I;16"):
        pil_img = pil_img.convert("RGB")

    arr = np.array(pil_img)

    # 16-bit normalisation (plan-scan Section 7 finding #5)
    if arr.dtype != np.uint8:
        max_val = arr.max()
        if max_val > 255:
            arr = (arr.astype(np.float32) / 65535.0 * 255.0).astype(np.uint8)
        else:
            arr = arr.astype(np.uint8)

    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr], axis=2)

    h, w = arr.shape[:2]
    if h < 200 or w < 200:
        raise ValueError(f"Image too small ({w}×{h}); minimum 200×200 required.")

    if arr.max() == 0:
        raise ValueError("Image is all-zero (completely black).")

    return arr  # RGB uint8, shape (H, W, 3)


# ── Scoreability gate ──────────────────────────────────────────────────────────

def is_scoreable(img_rgb: np.ndarray) -> tuple[bool, str]:
    """
    Returns (True, 'ok') if the image contains usable scene information.
    Returns (False, reason) for:
      - Night / dark frames: mean luminance < 20 (plan-scan Section 6c Image #1)
      - Overexposed / whiteout: mean luminance > 240
      - Uniformly flat scene: std of luminance < 5

    Fix 1.2 (new gate not in original code).
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mean_lum = float(gray.mean())
    std_lum = float(gray.std())

    if mean_lum < 20.0:
        return False, f"dark_frame (mean_lum={mean_lum:.1f} < 20)"
    if mean_lum > 240.0:
        return False, f"overexposed (mean_lum={mean_lum:.1f} > 240)"
    if std_lum < 5.0:
        return False, f"flat_scene (std_lum={std_lum:.1f} < 5)"
    return True, "ok"


# ── Preprocessing ──────────────────────────────────────────────────────────────

_TARGET_W, _TARGET_H = 800, 600
_CROP_FRAC = 0.08  # remove 8% border each side to drop camera overlays


def preprocess_for_metrics(img_rgb: np.ndarray) -> dict:
    """
    Returns three image variants used by different metrics (Fix 6):
      'full_rgb':  original RGB — for DCP (benefits from full resolution)
      'small_rgb': resized to 800×600 — resolution-normalised (Fix 6)
      'crop_rgb':  small_rgb with 8% border stripped — removes camera overlays
    """
    full_rgb = img_rgb

    bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    small_bgr = cv2.resize(bgr, (_TARGET_W, _TARGET_H), interpolation=cv2.INTER_AREA)
    small_rgb = cv2.cvtColor(small_bgr, cv2.COLOR_BGR2RGB)

    h, w = small_rgb.shape[:2]
    cy, cx = int(h * _CROP_FRAC), int(w * _CROP_FRAC)
    crop_rgb = small_rgb[cy : h - cy, cx : w - cx]

    return {"full_rgb": full_rgb, "small_rgb": small_rgb, "crop_rgb": crop_rgb}


# ── Individual metrics ─────────────────────────────────────────────────────────

def _dark_channel_raw(img_rgb_full: np.ndarray, patch_size: int = 15) -> float:
    """
    Dark Channel Prior on the full-resolution original image.
    Returns mean dark-channel value in [0, 100] (raw, before calibrated normalisation).
    Higher = more turbid (more scattered light filling dark regions).

    Kept from original Cell 6 — plan-scan Section 7 finding #1.
    """
    img_float = img_rgb_full.astype(np.float32) / 255.0
    min_channel = np.min(img_float, axis=2)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (patch_size, patch_size))
    dark = cv2.erode(min_channel, kernel)
    return float(np.mean(dark)) * 100.0


def dark_channel_score(img_rgb_full: np.ndarray, patch_size: int = 15) -> dict:
    """Returns {'raw': float [0,100], 'score': float [0,100]} where score=100 = most turbid."""
    raw = _dark_channel_raw(img_rgb_full, patch_size)
    return {"raw": round(raw, 3), "score": _to_turbidity(raw, "dcp")}


def tenengrad_sharpness(img_rgb_crop: np.ndarray) -> dict:
    """
    Tenengrad sharpness on the L-channel of LAB colourspace (Fix 2).
    Uses np.mean (not sum) — resolution-independent.
    Higher raw = sharper = clearer water (invert=True in _to_turbidity).
    Returns {'raw': float, 'score': float} where score=100 = most turbid (blurry).
    """
    lab = cv2.cvtColor(img_rgb_crop, cv2.COLOR_RGB2LAB)
    L = lab[:, :, 0].astype(np.float64)
    gx = cv2.Sobel(L, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(L, cv2.CV_64F, 0, 1, ksize=3)
    raw = float(np.mean(gx ** 2 + gy ** 2))
    return {"raw": round(raw, 3), "score": _to_turbidity(raw, "tenengrad")}


def blue_dominance(img_rgb_crop: np.ndarray) -> dict:
    """
    Blue-dominance ratio: mean(B) / (mean(R) + 1e-6) (Fix 3).
    Replaces the red-attenuation formula that confused deep-clear water with turbid water.
    Higher B/R = more blue dominant = clearer Adriatic water (invert=True).
    Returns {'raw': float, 'score': float} where score=100 = most turbid.
    """
    r = img_rgb_crop[:, :, 0].astype(np.float64)
    b = img_rgb_crop[:, :, 2].astype(np.float64)
    raw = float(np.mean(b) / (np.mean(r) + 1e-6))
    return {"raw": round(raw, 4), "score": _to_turbidity(raw, "blue_dom")}


def uicm_normalized(img_rgb_crop: np.ndarray) -> dict:
    """
    UICM (Underwater Image Colourfulness Measure) computed on 0-1 normalized pixels (Fix 4).
    Fixes the original: raw pixels (0-255) were fed into a formula calibrated for 0-1 values.
    Formula: -0.0268*sqrt(mu_rg²+mu_yb²) + 0.1586*sqrt(sigma_rg²+sigma_yb²)
    Higher UICM = more colourful = clearer (invert=True).
    Returns {'raw': float, 'score': float} where score=100 = most turbid.
    """
    img_f = img_rgb_crop.astype(np.float64) / 255.0
    r, g, b = img_f[:, :, 0], img_f[:, :, 1], img_f[:, :, 2]
    rg = r - g
    yb = 0.5 * (r + g) - b
    mu_rg, sigma_rg = float(np.mean(rg)), float(np.std(rg))
    mu_yb, sigma_yb = float(np.mean(yb)), float(np.std(yb))
    raw = (
        -0.0268 * np.sqrt(mu_rg ** 2 + mu_yb ** 2)
        + 0.1586 * np.sqrt(sigma_rg ** 2 + sigma_yb ** 2)
    )
    raw = float(raw)
    return {"raw": round(raw, 5), "score": _to_turbidity(raw, "uicm")}


# ── Main scoring entry point ───────────────────────────────────────────────────

# Weights for fixed turbidity components. Contrast removed (plan-scan 5a, 5b).
# DCP gets highest weight — best single discriminator (plan-scan Section 7 #1).
_WEIGHTS = {
    "dcp":       0.40,
    "tenengrad": 0.30,
    "blue_dom":  0.20,
    "uicm":      0.10,
}


def score_image(path: str) -> dict:
    """
    Full scoring pipeline for a single image.

    Returns a dict with:
      clarity_score   : primary output, 0=muddy, 100=clear (Fix 5)
      turbidity_score : inverse of clarity_score (kept for debugging)
      unscoreable_reason: None if scoreable, string reason otherwise
      metrics_raw     : dict of pre-normalisation values for each metric
      metrics_score   : dict of per-metric turbidity scores [0,100]
      path            : input path
      image_w, image_h: original image dimensions

    If the image fails the scoreability gate (dark frame, overexposed, flat):
      clarity_score and turbidity_score are None.
    """
    # Load
    try:
        img_rgb = load_image(path)
    except ValueError as e:
        return {
            "clarity_score": None,
            "turbidity_score": None,
            "unscoreable_reason": str(e),
            "metrics_raw": {},
            "metrics_score": {},
            "path": path,
            "image_w": None,
            "image_h": None,
        }

    h, w = img_rgb.shape[:2]

    # Scoreability gate (Fix 1.2)
    ok, reason = is_scoreable(img_rgb)
    if not ok:
        return {
            "clarity_score": None,
            "turbidity_score": None,
            "unscoreable_reason": reason,
            "metrics_raw": {},
            "metrics_score": {},
            "path": path,
            "image_w": w,
            "image_h": h,
        }

    # Preprocess (Fix 6 — resize + crop)
    views = preprocess_for_metrics(img_rgb)

    # Compute metrics
    dcp_res  = dark_channel_score(views["full_rgb"])
    ten_res  = tenengrad_sharpness(views["crop_rgb"])
    bd_res   = blue_dominance(views["crop_rgb"])
    uicm_res = uicm_normalized(views["crop_rgb"])

    # Weighted turbidity
    turbidity = (
        _WEIGHTS["dcp"]       * dcp_res["score"]  +
        _WEIGHTS["tenengrad"] * ten_res["score"]  +
        _WEIGHTS["blue_dom"]  * bd_res["score"]   +
        _WEIGHTS["uicm"]      * uicm_res["score"]
    )
    turbidity = float(np.clip(turbidity, 0.0, 100.0))
    clarity   = round(100.0 - turbidity, 2)
    turbidity = round(turbidity, 2)

    return {
        "clarity_score":      clarity,
        "turbidity_score":    turbidity,
        "unscoreable_reason": None,
        "metrics_raw": {
            "dcp":       dcp_res["raw"],
            "tenengrad": ten_res["raw"],
            "blue_dom":  bd_res["raw"],
            "uicm":      uicm_res["raw"],
        },
        "metrics_score": {
            "dcp_score":       dcp_res["score"],
            "tenengrad_score": ten_res["score"],
            "blue_dom_score":  bd_res["score"],
            "uicm_score":      uicm_res["score"],
        },
        "path":    path,
        "image_w": w,
        "image_h": h,
    }


# ── Legacy compatibility (Cell 5 pre_processing kept unchanged) ────────────────
# pre_processing() is left in main.ipynb for visualization use only.
# It is NOT called from any function in this module.
