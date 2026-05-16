# plan-scan.md — Forensic Review: Underwater Image Scoring Pipeline
**Date:** 2026-05-16  
**Reviewer:** Claude Sonnet 4.6  
**Status:** Read-only diagnosis — no scoring code changed.

---

## 1. Branch + Commit Context

```
branch:  improve/model
commits: 8b9e7c9  computer vision model
         5a85f20 Exctraction of images which are of a single object
         f7085be Added ability to send the datetime
```

The scoring code lives in `model/main.ipynb`. There are no separate `.py` modules.

---

## 2. Folder Inventory

| Path | Lang | Lines | Purpose |
|------|------|-------|---------|
| `model/main.ipynb` | Python/Jupyter | ~220 source lines, 7 cells | Entire scoring pipeline — image prep, metrics, turbidity score |
| `model/data/train/images/` | — | 2,505 JPEG files | Training images from 3 cameras |
| `model/data/train/labels/` | YOLO txt | 2,505 files | Object detection annotations (not visibility scores) |
| `model/data/valid/images/` | — | 538 JPEG files | Validation images |
| `model/data/valid/labels/` | YOLO txt | 538 files | Object detection annotations |
| `model/data/test/images/` | — | 525 JPEG files | Test images |
| `model/data/test/labels/` | YOLO txt | 525 files | Object detection annotations |
| `model/_forensic_probe.py` | Python | ~140 | ← added by this review for empirical Step 4 only; safe to delete |

**Camera sources (inferred from filenames):**
- `IPC608_8B64_165` / `IPC608_8BC7_166` — 1920×1080 compact cameras
- `AIPC608UW_10_167` — 2688×1520 underwater camera  
- `C4k0193` — 2688×1512 or 2688×1520 4K camera

**IMPORTANT: The `labels/` files are YOLO object-detection annotations (class_id, cx, cy, w, h), not visibility scores.** There is no pre-existing ground-truth visibility label for any image. The scoring pipeline must generate those labels from scratch.

**Entry points:**
- `main.ipynb` Cell 6: `score_image(path)` — the only end-to-end callable function.
- `main.ipynb` Cell 5: `pre_processing(path)` — must be called before Cell 6's scorer.
- There is no CLI, no batch runner, no saved output file.

**Dead code / leftover experiments:**
- **Cell 0–1**: Imports `copernicusmarine` and downloads Indian Ocean current data for Jan 2020. Completely unrelated to image scoring. Dead experiment from a different project. Cell 1 tries to authenticate to Copernicus Marine (prints "Abort" in the recorded output).
- **Cell 2**: Copies images with substring `IPC608_8B64_165.jpg` from a hardcoded Linux path `/home/momir19/...`. Useful once for data prep; now dead since images are in `data/`.
- **Cell 3**: EasyOCR corner text extraction. References `easyocr` without importing it — would crash immediately. Useful concept (removing camera overlays), but broken and not wired to the scorer.
- **Cell 4**: Roboflow upload with placeholder `api_key="YOUR_PRIVATE_API_KEY"`. Dead experiment.
- **Cell 5**: `show_img()` helper — never called in the scoring path. Not harmful, just unused.

---

## 3. Current Pipeline Data Flow

```
1. ENTRY: score_image(image_path)          [main.ipynb Cell 6, bottom]
2. pre_processing(image_path)              [main.ipynb Cell 5]
   ├─ PIL.Image.open → uint8 array
   ├─ x2 contrast + add 255 to EVERY pixel (alpha=2, beta=255)
   ├─ morphological background subtraction (dilate → divide → invert)
   ├─ cv2.fastNlMeansDenoising
   └─ cv2.GaussianBlur(3,3) → returns "blurred" grayscale
3. estimate_turbidity(image_path, blurred) [main.ipynb Cell 6]
   ├─ Reload original RGB with PIL (separate from step 2 above)
   ├─ FEATURE 1: dark_channel(rgb/255) → mean * 100 → dark_channel_score
   ├─ FEATURE 2: std(blurred)/255 → (1 - rms_contrast)*100 → contrast_score
   ├─ FEATURE 3: mean_r/(mean_all) → red_attenuation → color_score
   ├─ FEATURE 4: var(Laplacian(blurred)) → (1 - clip/300)*100 → sharpness_score
   ├─ FEATURE 5: UICM formula on raw 0-255 RGB → (1 - clip)*100 → uicm_score
   └─ weighted sum: 0.30*DarkCh + 0.25*Contrast + 0.20*Sharpness
                  + 0.15*Color + 0.10*UICM → turbidity_score [0–100]
4. OUTPUT: dict with turbidity_score and per-component breakdown
   (0 = crystal clear, 100 = zero visibility)
   ↑↑↑ NOTE: This is TURBIDITY not CLARITY — the direction is INVERTED
   from what the ML pipeline expects ("higher = clearer").
```

---

## 4. Per-Metric Analysis Table

| Metric | Conceptual purpose | Implementation (file:cell) | Theoretical range | Empirical range (n=15) | Normalization method | Weight | Calibrated? |
|--------|-------------------|---------------------------|-------------------|----------------------|---------------------|--------|-------------|
| Dark channel prior | Haze/turbidity via scattered light | `Cell 6: np.min(img,axis=2)` + erosion | 0–100 | **1.6–48.5** (std=11.3) | `mean(dc)*100` | 0.30 | No |
| Contrast (RMS) | Brightness spread of preprocessed gray | `Cell 6: np.std(blurred)/255` | 0–100 | **96.5–99.9** (std=0.9) | `(1-rms)*100` | 0.25 | No |
| Sharpness (Laplacian) | Edge energy of preprocessed gray | `Cell 6: np.var(Laplacian(blurred))` | 0–100 | **88.9–100.0** (std=3.8) | `(1-clip(var/300))*100` | 0.20 | No |
| Color cast (red att.) | Red channel depletion vs mean | `Cell 6: 1 - mean_r/(total/3)` | 0–100 | **0.0–35.6** (std=10.1) | `clip(red_att)*100` | 0.15 | No |
| UICM | Colorfulness via opponent channels | `Cell 6: -0.0268*sqrt(…)+0.1586*sqrt(…)` | 0–100 (wrong) | **0.0–46.0** (std=11.4) | `(1-clip((u+10)/20))*100` | 0.10 | No |
| **FINAL SCORE** | Turbidity (0=clear, 100=muddy) | Weighted sum | 0–100 | **54.2–65.2** (std=3.4) | — | — | No |

**Raw (pre-normalization) empirical ranges:**

| Metric raw | min | p25 | median | p75 | max | std |
|------------|-----|-----|--------|-----|-----|-----|
| dark_channel mean (×100) | 1.6 | 29.2 | 35.1 | 38.9 | 48.5 | 11.3 |
| preprocessed gray std (0–255) | 0.7 | 4.1 | 6.5 | 9.1 | 8.8 | 2.3 |
| Laplacian var on preprocessed | 0.1 | 3.4 | 12.3 | 22.6 | 33.2 | 10.5 |
| Laplacian var on ORIGINAL gray | 0.2 | 42.1 | 196.6 | 419.8 | 1099.3 | 350.1 |
| red_attenuation (0–1) | 0.0 | 0.083 | 0.158 | 0.234 | 0.356 | 0.099 |
| uicm_raw | 0.8 | 2.2 | 3.4 | 4.9 | 10.1 | 2.5 |

---

## 5. Diagnosis: Why Scores Cluster at Mid

**Summary first:** The final score range is **10.9 points** (54.2–65.2) on a 100-point scale. Two of the five metrics are effectively constants. The preprocessing pipeline systematically destroys the two metrics that depend on it. The result is that 68% of each score is a fixed offset, and the remaining 32% of variable signal is divided among metrics with problems of their own.

### 5a. Normalization Flattening

**Bug 1 — Preprocessing makes `contrast_score` a constant.**

`Cell 5`: `raw_img = np.clip(img_arr * 2 + 255, 0, 65535)` adds 255 to every pixel before any other operation. For 8-bit inputs (0–255), this forces all values into the range 255–765. The subsequent `cv2.divide(first_method, bg, scale=255)` divides by the dilated image, producing values 0–255 for the contrast-normalized result. Then `255 - out_gray` inverts it, denoising removes detail, and `GaussianBlur(3,3)` smooths.

The empirical result: the preprocessed grayscale has std of only **0.7–8.8** out of 255. `rms_contrast = std/255 ≈ 0.003 to 0.035`. Therefore `contrast_score = (1 - 0.003)*100 ≈ 97 to 99.7` for every single image. **The contrast_score has a total range of 3.4 points across 15 diverse images.** It contributes a near-constant `0.25 × ~98.3 = 24.6` to every score.

```python
# Cell 5 — the beta=255 that destroys contrast discrimination:
alpha = 2
beta = 255   # ← every pixel floor is now 255; no dark-region information survives
raw_img = np.clip(img_arr.astype(np.float64) * alpha + beta, 0, 65535).astype(np.float64)
```

**Bug 2 — Preprocessing makes `sharpness_score` near-constant.**

The Laplacian variance is computed on the GaussianBlur output of the preprocessed image. Because the preprocessing compresses and inverts the image and GaussianBlur removes high-frequency content, the preprocessed Laplacian variance ranges **0.1–33.2**. Normalized by `/300`, this gives values 0.0003 to 0.11, meaning `sharpness_score = (1 - ~0.04) × 100 ≈ 89–100` for all images. A 4K clear image (lap_var_original=1099) and a dark 36KB near-black image (lap_var_original=0.2) produce sharpness scores of 89.5 and 100.0 respectively. The preprocessing collapses a 5,000× real sharpness range to an 11-point output range.

```python
# Cell 6 — Laplacian computed on already-blurred preprocessed image:
laplacian = cv2.Laplacian(blurred_preprocessed, cv2.CV_64F)  # blurred_preprocessed is blur(denoise(invert(...)))
lap_var = float(np.var(laplacian))
sharpness_score = (1.0 - np.clip(lap_var / 300.0, 0, 1)) * 100
```

The `/ 300.0` normalization was presumably calibrated on the original image, not the blurred preprocessed one. The real preprocessed Laplacian variance never approaches 300 in practice.

**Combined effect of bugs 1+2:** `0.25 * 98.3 + 0.20 * 96.3 = 24.6 + 19.3 = 43.9`. Nearly 44 points of every score is a constant floor from two broken metrics.

### 5b. Averaging Destroys Signal

The weighted sum:
```python
# Cell 6:
turbidity_score = (
    0.30 * dark_channel_score +  # range: 1.6–48.5 → contributes 0.5–14.6
    0.25 * contrast_score     +  # range: 96.5–99.9 → CONSTANT ~24.6
    0.20 * sharpness_score    +  # range: 88.9–100.0 → CONSTANT ~19.3
    0.15 * color_score        +  # range: 0.0–35.6 → contributes 0.0–5.3
    0.10 * uicm_score            # range: 0.0–46.0 → contributes 0.0–4.6
)
```

The two non-constant metrics with meaningful signal (dark_channel: max contribution 14.6 pts, uicm: max 4.6 pts) are diluted by two constants. The best possible spread from variable terms is approximately 20 points. But because contrast and sharpness both sit at ~98, the fixed floor is 44, and the ceiling is 44+20=64. This mathematically bounds every output to roughly 44–64 before clipping. The measured range (54.2–65.2) confirms this.

**Additionally, the directions are inconsistent and partially wrong:**
- dark_channel_score: HIGH = turbid ✓  
- contrast_score: HIGH = turbid ✓ (but constant, so irrelevant)
- sharpness_score: HIGH = turbid ✓ (but constant)
- color_score: HIGH = red attenuation = turbid? ✗ (see 5c)
- uicm_score: HIGH = low colorfulness = turbid? (debatable)

The C4k0193 4K clear images (open-water, well-lit) score 0.0 for color_score because `mean_r >= total/3` (balanced channels → `red_attenuation < 0` → clipped to 0). Clear balanced-color images score 0 turbidity on the color metric, meaning they appear "clear" by this metric. But `color_score=0` means it contributes 0 to turbidity. This is correct directionally but means the metric gives no positive signal for clear images — it only punishes extremely blue-dominated images.

### 5c. Wrong Metrics for Underwater

**Sharpness (Laplacian variance):** Computed on the preprocessed output, not the original. As shown above, this metric is effectively dead. But even on the original: the 36KB image (meanR=6, meanG=7, meanB=13, lap_var_orig=0.2) is almost certainly a night/dark image with no useful information — not a sharp clear-water image. Low Laplacian variance = "dark scene or no features" ≠ "clear water." The metric cannot distinguish.

**Color cast (red attenuation):** `Cell 6, line ~46`:
```python
red_attenuation = 1.0 - (mean_r / (total / 3.0 + 1e-6))
```
Both deep clear Adriatic water AND turbid water have low red channels. Clear water at depth attenuates red heavily because pure seawater absorbs red wavelengths. The formula cannot distinguish "red attenuated by clean deep water" from "red attenuated by turbid shallow water." The two C4k0193 images (both likely clear open water, file sizes 1.5–1.9MB) both score `color_score=0.0` because their mean_r is not below average. This is the correct score for clear water — but the metric is measuring the wrong thing and getting lucky.

**UICM:** The formula from the FUnIE-GAN paper is designed for normalized 0–1 pixel values. It is applied here to 0–255 raw pixels:
```python
# Cell 6:
rg = r - g          # r, g are 0–255 float32
yb = 0.5*(r+g) - b
uicm = -0.0268 * np.sqrt(mu_rg**2 + mu_yb**2) + 0.1586 * np.sqrt(sigma_rg**2 + sigma_yb**2)
uicm_score = (1.0 - np.clip((uicm + 10) / 20.0, 0, 1)) * 100
```
The empirical `uicm_raw` ranges 0.8–10.1. The normalization `(uicm+10)/20` was designed for a range of approximately -10 to +10 (for 0-1 pixel values, this gives ~-0.5 to +0.5, so the normalization range of ±10 is wildly wrong). For the 0–255 scale actually used, `uicm_raw` hits the ceiling of the normalization at values >= 10, mapping those images to `uicm_score=0`. The `20230325-180000-C4k0193.jpg` image (large clear 4K image) has `uicm_raw=10.1`, clips to `uicm_score=0` — treated as "perfectly clear" by this metric, which accidentally happens to be correct (it's probably a clear image), but for the wrong reason.

### 5d. Resolution / Preprocessing Issues

**No resolution normalization:**
```python
# Cell 5: no resize before any processing
img_arr = np.array(Image.open(image_sample))
# Image sizes vary: 1920×1080, 2688×1520, 2688×1512, 2560×1440
```
The Laplacian variance on the original (before preprocessing) ranges from **0.2 to 1099** across the 15 images. A significant portion of this range is resolution-driven, not content-driven. The 4K C4k0193 cameras at 2688×1512 produce lap_var_orig 1000+; the 1920×1080 IPC608 cameras rarely exceed 350 even for sharp scenes. The scorer would assign systematically lower sharpness scores to IPC608 footage than to C4k0193 footage of identical water clarity.

**BGR vs RGB:** The preprocessing function uses PIL (`Image.open`) which returns **RGB**. The scoring function `estimate_turbidity` also uses PIL for the color metrics:
```python
# Cell 6:
img_rgb = np.array(Image.open(original_rgb_path)).astype(np.float32)
r = img_rgb[:,:,0]  # ← correctly reads RED channel (PIL = RGB)
```
The dark_channel function also receives this PIL-loaded array, so channel ordering is consistent. **No BGR/RGB confusion here** — this is one thing that's correct.

However, the preprocessing function `pre_processing` uses PIL for loading and returns a **grayscale** array via background subtraction. Then `estimate_turbidity` calls `cv2.Laplacian(blurred_preprocessed, cv2.CV_64F)` on this grayscale. That call is fine.

**Camera watermarks / overlays:** Cell 3 shows an EasyOCR attempt to read timestamp overlays — but that function is never called, `easyocr` is never imported, and it would crash. Camera overlays (timestamps, depth readouts burned into corners) affect edge metrics. No cropping is applied before scoring.

**JPEG artifacts:** No handling. Heavily compressed images (36KB for 1920×1080) will have severe 8×8 DCT block artifacts. These inflate Laplacian variance on the original image but are smoothed away in preprocessing. Both effects are real but partially self-cancelling.

### 5e. Aggregation Formula — Mathematical Proof of Mid-Clustering

**Exact formula:**
```
score = 0.30·dc + 0.25·co + 0.20·sh + 0.15·cl + 0.10·ui
```
where all terms are in [0, 100] and represent turbidity (high = muddy).

**Empirical contribution ranges from this dataset:**

| Term | Weight | Empirical range | Contribution range |
|------|--------|-----------------|-------------------|
| dc (dark channel) | 0.30 | 1.6 – 48.5 | **0.5 – 14.6** |
| co (contrast) | 0.25 | 96.5 – 99.9 | **24.1 – 25.0** ← constant |
| sh (sharpness) | 0.20 | 88.9 – 100.0 | **17.8 – 20.0** ← nearly constant |
| cl (color) | 0.15 | 0.0 – 35.6 | **0.0 – 5.3** |
| ui (UICM) | 0.10 | 0.0 – 46.0 | **0.0 – 4.6** |

**Floor from constants:** 24.1 + 17.8 = **41.9** minimum from co+sh alone.  
**Ceiling from constants:** 25.0 + 20.0 = **45.0** maximum from co+sh alone.

**Total variable signal available:** (0.5–14.6) + (0.0–5.3) + (0.0–4.6) = **0.5 – 24.5**

**Predicted score range:** 41.9+0.5 to 45.0+24.5 = **42.4 to 69.5**  
**Actual measured range:** 54.2 to 65.2 (tighter than predicted because variable metrics are correlated and don't all hit their extremes simultaneously)

**For the three regimes:**
| Regime | dark_ch | contrast | sharpness | color | uicm | **score** |
|--------|---------|----------|-----------|-------|------|-----------|
| Clear (sharp, blue, low haze) | low ~5 | ~98 | ~100 | low ~5 | low ~20 | **55.5** |
| Mid (moderate everything) | ~30 | ~98 | ~97 | ~15 | ~33 | **59.2** |
| Muddy (hazy, brown, flat) | high ~45 | ~99 | ~95 | ~30 | ~40 | **63.3** |

The formula produces an **8-point spread** between clearly clear and clearly muddy. A regressor cannot learn from 8 points of variation across the entire label range.

### 5f. Missing Features

1. **No turbidity-specific transmission estimate.** The dark channel is used, but it's applied to a mix of original image (good) while Laplacian is applied to a processed version (bad). There is no actual transmission map (`t = 1 - ω·min_channel/A` where A is atmospheric light) — just the raw dark channel mean.

2. **No spatial uniformity check.** Turbid water creates spatially uniform low-sharpness. A clear image with one blurry fish and the rest sharp should score high clarity. A turbid image with uniform blur everywhere scores the same as the clear one on Laplacian variance. The code measures only the global variance, not its spatial distribution.

3. **No reference color baseline.** There is no comparison to a known "clear Adriatic water" color histogram. Absolute channel means are used instead of deviation from a baseline — this fails to account for depth, time-of-day, and camera white balance differences.

4. **No batch output / label file.** `score_image()` prints to stdout and returns a dict. There is no code to run the scorer over `data/*/images/` and write a CSV that maps `image_path → turbidity_score`. Without this, the scores cannot be joined to the weather FeatureRow data to create training labels.

5. **No timestamp → FeatureRow join.** Even if a batch output existed, there is no code to parse the timestamp from the filename (`20231007-090201-IPC608_8B64_165.jpg` → `2023-10-07 09:02:01`) and match it to the backend's FeatureRow CSV by nearest timestamp.

### 5g. Robustness Bugs

**Bug: `pre_processing` crashes on grayscale images.** `cv2.morphologyEx` with `MORPH_DILATE` on a 2D float64 array returns 2D. But `cv2.divide(first_method, bg, scale=255)` when both are float64 2D will return 2D. The rest of the function assumes 2D output. If an image is already grayscale (single channel), `Image.open` returns mode 'L', and `np.array` gives shape `(H, W)` — this is fine for grayscale. But if an image has an alpha channel (mode 'RGBA'), `img_arr.shape = (H, W, 4)` — the subsequent operations are undefined. Cell 3's OCR code handles this explicitly; the scoring code does not.

**Bug: `pre_processing` silently corrupts 16-bit images.** The cast `out_gray.astype(np.uint8)` truncates values. The comment suggests 16-bit support (`img.max() > 255` → normalize to 8-bit), but this only exists in `estimate_turbidity`, not in `pre_processing`. A 16-bit input to `pre_processing` produces corrupted results.

**Bug: `score_image` hardcodes a Linux path that does not exist.**
```python
# Cell 6, last lines:
score_image("/home/momir19/famnit_hackathon2026/model/copied_images/20240615-135201-IPC608_8B64_165.jpg")
```
This crashes on any non-Linux machine or wherever the path doesn't exist.

**Bug: `easyocr` referenced but never imported.** Cell 3 calls `easyocr.Reader(...)` without `import easyocr`. The cell would raise `NameError: name 'easyocr' is not defined`.

**Bug: `fast_nlMeansDenoising` called on the wrong type in edge cases.** `cv2.fastNlMeansDenoising` requires uint8 input. `out_gray.astype(np.uint8)` is called before this, so normally fine. But if `cv2.divide` returns float64 values outside [0, 255], the cast silently wraps them (e.g., 256 → 0). Empirically this appears to work but is fragile.

**No random seeds:** None of the metrics involve randomness, so this is not an issue here.

**Division by zero:** `total = mean_r + mean_g + mean_b + 1e-6` — the `+ 1e-6` guard exists. Correct.

**NaN propagation:** `np.clip(red_attenuation, 0, 1)` clips NaN to NaN (clip does not convert NaN). If `mean_r` or `total` is NaN (can happen if PIL fails to load → all-zero image → total = 1e-6, result = 1 - 0 = 1 → no NaN). Low risk in practice.

---

## 6. Empirical Validation: 15-Image Results

**Setup:** 5 images per split (train/valid/test), selected by file size spread (smallest to largest as a proxy for image content variation). Scorer run verbatim from Cells 5+6 without modification.

### 6a. Full 15-Image Table

| # | Image | Split | Size | Resolution | DarkCh | Contrast | Sharp | Color | UICM | **Score** | LapOrig |
|---|-------|-------|------|-----------|--------|----------|-------|-------|------|-----------|---------|
| 1 | 20231016-173101-IPC608_8B64_165 | train | 36KB | 1920×1080 | 1.6 | 99.9 | 100.0 | 30.0 | 44.0 | **54.4** | 0.2 |
| 2 | 20231002-055401-IPC608_8B64_165 | train | 136KB | 1920×1080 | 17.5 | 98.7 | 98.8 | 35.6 | 30.4 | **58.1** | 48.2 |
| 3 | 20231018-105601-IPC608_8B64_165 | train | 232KB | 1920×1080 | 39.0 | 97.9 | 96.3 | 18.1 | 29.7 | **61.1** | 196.6 |
| 4 | 20240401-141501-AIPC608UW_10_167 | train | 677KB | 2688×1520 | 27.1 | 96.5 | 88.9 | 25.5 | 26.1 | **56.5** | 536.2 |
| 5 | 20230404-120000-C4k0193 | train | 1901KB | 2688×1512 | 35.1 | 98.0 | 89.5 | 0.0 | 39.5 | **56.9** | 1099.3 |
| 6 | 20231202-142401-IPC608_8B64_165 | valid | 45KB | 1920×1080 | 46.0 | 99.7 | 99.9 | 8.1 | 46.0 | **64.5** | 5.1 |
| 7 | 20231001-102401-IPC608_8B64_165 | valid | 157KB | 1920×1080 | 38.9 | 98.6 | 98.6 | 17.1 | 33.0 | **61.9** | 75.8 |
| 8 | 20240411-121901-IPC608_8B64_165 | valid | 268KB | 2688×1520 | 37.8 | 98.8 | 98.8 | 22.7 | 37.4 | **63.0** | 52.0 |
| 9 | 20240505-160901-IPC608_8BC7_166 | valid | 735KB | 2688×1520 | 32.7 | 97.4 | 93.3 | 11.0 | 25.6 | **57.0** | 348.3 |
| 10 | 20230404-160000-C4k0193 | valid | 1863KB | 2688×1512 | 33.8 | 98.1 | 90.1 | 0.0 | 38.9 | **56.6** | 1063.9 |
| 11 | 20240229-132001-IPC608_8B64_165 | test | 47KB | 1920×1080 | 48.5 | 99.6 | 99.8 | 7.9 | 45.6 | **65.2** | 11.4 |
| 12 | 20240306-Video-2-IPC608_8B64_166_frame087 | test | 146KB | 1920×1080 | 42.6 | 99.0 | 98.2 | 8.6 | 36.2 | **62.1** | 36.0 |
| 13 | 20231007-090201-IPC608_8B64_165 | test | 247KB | 1920×1080 | 38.9 | 97.7 | 95.9 | 15.8 | 22.5 | **59.9** | 237.6 |
| 14 | 20240410-120800-Video-AIPC608UW_10_167_frame010 | test | 677KB | 2560×1440 | 28.5 | 97.1 | 92.5 | 23.4 | 23.0 | **57.1** | 260.6 |
| 15 | 20230325-180000-C4k0193 | test | 1548KB | 2688×1512 | 29.9 | 98.5 | 95.9 | 9.9 | 0.0 | **54.2** | 491.3 |

*Visual judgment (from filename inference and file size): #1 = very likely dark/night (36KB at 1080p = nearly black); #5,#10,#15 = likely open clear water (4K, large files); #6,#11 = likely turbid (high dark_channel ~46-48, very small files)*

### 6b. Distribution Statistics

| Metric | min | p5 | p25 | median | p75 | p95 | max | std |
|--------|-----|-----|-----|--------|-----|-----|-----|-----|
| **FINAL SCORE** | 54.2 | 54.3 | 56.7 | 58.1 | 62.0 | 64.7 | 65.2 | **3.4** |
| dark_channel_score | 1.6 | 12.8 | 29.2 | 35.1 | 38.9 | 46.8 | 48.5 | 11.3 |
| contrast_score | 96.5 | 96.9 | 97.8 | 98.5 | 98.9 | 99.7 | 99.9 | **0.9** |
| sharpness_score | 88.9 | 89.3 | 92.9 | 96.3 | 98.8 | 99.9 | 100.0 | **3.8** |
| color_score | 0.0 | 0.0 | 8.3 | 15.8 | 23.0 | 31.7 | 35.6 | 10.1 |
| uicm_score | 0.0 | 15.7 | 25.8 | 33.0 | 39.2 | 45.7 | 46.0 | 11.4 |
| **Laplacian (original)** | 0.2 | 3.6 | 42.1 | 196.6 | 419.8 | 1074.5 | 1099.3 | **350.1** |

**Score range: 10.9 points.** The Laplacian on the original (unused) image has a range of 1099 — over 100× more discriminating than the sharpness metric actually used.

### 6c. Worst Failure Cases

**Image #1 (36KB, lap_orig=0.2) vs Image #5 (1901KB, lap_orig=1099) — scores 54.4 vs 56.9.**
A near-black night image and a sharp 4K clear-water image differ by only 2.5 points. These two should be at opposite extremes of any reasonable visibility scale. Instead they are statistically indistinguishable. The root cause: both have contrast_score ~99 and sharpness_score ~90-100 due to preprocessing destroying the real signal.

**Image #6 (valid, 45KB, dark_channel=46) vs Image #10 (valid, 1863KB, dark_channel=34) — scores 64.5 vs 56.6.**
The darkest-channel image (#6, likely the most turbid) scores 64.5 — only 8 points above the clearest-looking image (#10 at 56.6). An 8-point difference on a 100-point label scale is below the noise floor of any practical regressor.

**Image #1 (36KB near-black, score=54.4) vs Image #15 (1548KB 4K clear, score=54.2) — scores differ by 0.2 points.**
These two should represent the extreme poles of the scale. They are separated by 0.2 — a difference that will be invisible to any downstream regressor.

### 6d. Errors / Crashes

None of the 15 images crashed the scorer. The scorer runs to completion on all images, which makes the clustering problem harder to notice in testing — it silently produces plausible-looking numbers that are actually useless.

---

## 7. What Is Good in the Current Code

**1. Dark channel prior is the right conceptual choice.** The `dark_channel()` function in Cell 6 correctly implements the DCP using `np.min(img, axis=2)` followed by morphological erosion. The empirical data confirms it is the most discriminating metric in the pipeline (std=11.3, range 1.6–48.5). It is correctly applied to the normalized 0–1 original image. The patch_size=15 is reasonable. This metric and function should be kept.

**2. The UICM formula direction is correct for the 0–255 scale (accidentally).** For 0-1 normalized inputs (as intended in the paper), UICM would produce very small values all clustered near -0.5 to +0.5, and the `(u+10)/20` normalization would flatten everything to near 0.5. But with 0–255 inputs, the formula produces larger values (0.8–10.1 in this sample) that actually spread out in the normalization's active range. The accident works better than the intended 0–1 usage would have.

**3. PIL loading is consistent throughout.** Both `pre_processing` and `estimate_turbidity` use `Image.open()`, so both see RGB-ordered arrays. There is no BGR/RGB confusion — `img_rgb[:,:,0]` is correctly the red channel everywhere in the scoring code.

**4. Division-by-zero guard exists.**
```python
total = mean_r + mean_g + mean_b + 1e-6
```
This prevents division by zero for all-black images.

**5. 16-bit image handling in `estimate_turbidity`.**
```python
if img_rgb.max() > 255:
    img_rgb = (img_rgb / 65535.0 * 255.0)
```
This correctly normalizes 16-bit images before computing color metrics. (It's absent from `pre_processing`, which is a bug, but its presence here for the color-metric path is correct.)

**6. Weighted combination is the right structure.** Using a weighted sum with domain-defined weights (rather than, e.g., a pure lookup table or binary threshold) is the right architecture. The weights can be tuned; the structure supports it.

---

## 8. Ranked Fix List

Sorted by expected impact on score discrimination, highest first.

---

### Fix 1 — Rip out `pre_processing()` for metrics; use original image directly (Large, highest impact)

**File:Cell:** `main.ipynb Cell 5` and the call in `Cell 6: score_image()`

**What to change:**
```python
# REMOVE this entirely from the scoring path (keep for display/visualization only):
def pre_processing(image_sample): ...

# In estimate_turbidity, remove the blurred_preprocessed parameter.
# Compute ALL metrics directly from img_rgb.
# For metrics that need grayscale:
gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)  # NOT the blurred output
```

**Why:** The preprocessing kills contrast_score (std drops from real ~30–80 to ~0.7–8.8) and sharpness_score (Laplacian drops from 0–1100 to 0–33). These two metrics together account for 45% of the final score and are currently constants. Removing preprocessing from the metric path immediately restores ~45% of the weight to meaningful variation.

**Estimated effort:** Small  
**Needs recalibration:** Yes — both `/ 255` for contrast and `/ 300` for sharpness will need new bounds.

---

### Fix 2 — Replace Laplacian variance with Tenengrad on L-channel of LAB (Small)

**File:Cell:** `main.ipynb Cell 6`, inside `estimate_turbidity`

**Replace:**
```python
laplacian = cv2.Laplacian(blurred_preprocessed, cv2.CV_64F)
lap_var = float(np.var(laplacian))
sharpness_score = (1.0 - np.clip(lap_var / 300.0, 0, 1)) * 100
```

**With:**
```python
lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB)
L = lab[:, :, 0].astype(np.float64)
gx = cv2.Sobel(L, cv2.CV_64F, 1, 0, ksize=3)
gy = cv2.Sobel(L, cv2.CV_64F, 0, 1, ksize=3)
tenengrad = float(np.mean(gx**2 + gy**2))  # mean not sum → resolution-independent
# Calibrate LOW and HIGH from empirical sample (see Fix 7):
TENENGRAD_LOW, TENENGRAD_HIGH = 50.0, 3000.0   # placeholder; measure on your data
sharpness_raw = np.clip((tenengrad - TENENGRAD_LOW) / (TENENGRAD_HIGH - TENENGRAD_LOW), 0, 1)
sharpness_score = (1.0 - sharpness_raw) * 100  # inverted: low sharpness = high turbidity
```

**Why:** Tenengrad (sum/mean of squared Sobel gradients) is significantly more robust to JPEG block artifacts than Laplacian. Using the L-channel of LAB removes the chromatic aberration bias that affects gradient metrics on blue-heavy underwater images. Using `np.mean` instead of `np.sum` makes the metric resolution-independent — a 4K and 1080p image of the same scene will score the same.

**Estimated effort:** Trivial  
**Needs recalibration:** Yes — TENENGRAD_LOW and TENENGRAD_HIGH must be set from the calibration distribution.

---

### Fix 3 — Replace red attenuation with Blue Dominance Ratio (Trivial)

**File:Cell:** `main.ipynb Cell 6`, color_score computation

**Replace:**
```python
red_attenuation = 1.0 - (mean_r / (total / 3.0 + 1e-6))
red_attenuation = np.clip(red_attenuation, 0, 1)
color_score = float(red_attenuation) * 100
```

**With:**
```python
# Higher ratio = more blue dominance = clearer Adriatic water
blue_dominance = mean_b / (mean_r + 1e-6)
# Clip and normalize: clear Adriatic typically 1.0–3.0; turbid 0.7–1.2
BD_LOW, BD_HIGH = 0.7, 3.0   # placeholder; calibrate
color_raw = np.clip((blue_dominance - BD_LOW) / (BD_HIGH - BD_LOW), 0, 1)
color_score = (1.0 - color_raw) * 100  # inverted: high B/R = low turbidity
```

**Why:** The current red_attenuation measures deviation of red from the channel average, which confuses deep-clear water (low red due to absorption) with turbid water (low red due to scattering + absorption). Blue dominance (B/R ratio) is a better discriminator for the Adriatic specifically: turbid coastal water has silt/algae that elevates green-brown channels relative to blue, reducing the B/R ratio. Clear offshore water has strongly dominant blue channel.

**Estimated effort:** Trivial  
**Needs recalibration:** Yes — BD_LOW and BD_HIGH need calibration.

---

### Fix 4 — Fix UICM to use normalized 0–1 pixels AND correct normalization bounds (Small)

**File:Cell:** `main.ipynb Cell 6`, UICM block

**Replace:**
```python
rg = r - g       # r, g are 0–255 → produces large values
yb = 0.5*(r+g)-b
...
uicm_score = (1.0 - np.clip((uicm + 10) / 20.0, 0, 1)) * 100
```

**With:**
```python
# Normalize to 0–1 first, as the original paper specifies
r_n = r / 255.0; g_n = g / 255.0; b_n = b / 255.0
rg_n = r_n - g_n
yb_n = 0.5 * (r_n + g_n) - b_n
mu_rg_n, sigma_rg_n = np.mean(rg_n), np.std(rg_n)
mu_yb_n, sigma_yb_n = np.mean(yb_n), np.std(yb_n)
uicm_n = -0.0268 * np.sqrt(mu_rg_n**2 + mu_yb_n**2) + 0.1586 * np.sqrt(sigma_rg_n**2 + sigma_yb_n**2)
# Calibrate from empirical distribution (see Fix 7):
UICM_LOW, UICM_HIGH = -0.05, 0.30   # placeholder
uicm_normalized = np.clip((uicm_n - UICM_LOW) / (UICM_HIGH - UICM_LOW), 0, 1)
uicm_score = (1.0 - uicm_normalized) * 100
```

**Why:** The 0-255 scale makes uicm_raw 100× too large for the normalization bounds. With 0-1 normalization, UICM values will be ~0.008–0.101 (close to 0), and calibrated bounds will produce genuine 0–100 output. This is a correctness fix, not a discrimination fix — the metric is conceptually valid once applied correctly.

**Estimated effort:** Small  
**Needs recalibration:** Yes — UICM_LOW and UICM_HIGH need empirical setting.

---

### Fix 5 — Invert the final score direction to produce CLARITY not TURBIDITY (Trivial)

**File:Cell:** `main.ipynb Cell 6`, final return

**Replace:**
```python
turbidity_score = float(np.clip(turbidity_score, 0, 100))
return {
    "turbidity_score": round(turbidity_score, 2),
    ...
}
```

**With:**
```python
turbidity_score = float(np.clip(turbidity_score, 0, 100))
clarity_score = 100.0 - turbidity_score  # ← invert: 0=muddy, 100=clear
return {
    "clarity_score": round(clarity_score, 2),
    "turbidity_score": round(turbidity_score, 2),  # keep for debugging
    ...
}
```

**Why:** The task specification says "higher = clearer water." The current output is inverted. The ML regressor will either need to negate all labels or the scorer needs to flip its output. This is a one-line fix that prevents a silent direction error in training data.

**Estimated effort:** Trivial  
**Needs recalibration:** No

---

### Fix 6 — Add pre-processing resize to canonical resolution (Small)

**File:Cell:** `main.ipynb Cell 6`, at the start of `estimate_turbidity`

**Add:**
```python
TARGET_W, TARGET_H = 800, 600  # canonical resolution for metric computation

img_rgb_orig = img_rgb.copy()  # keep original for DCP (which benefits from full res)
img_rgb_small = cv2.resize(
    cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR),  # cv2 resize expects BGR or gray
    (TARGET_W, TARGET_H),
    interpolation=cv2.INTER_AREA
)
img_rgb_small = cv2.cvtColor(img_rgb_small, cv2.COLOR_BGR2RGB)
# Use img_rgb_small for Tenengrad, UICM, color metrics
# Use img_rgb_orig for DCP (patch-based, benefits from higher resolution)
```

**Also add center crop to remove camera overlays:**
```python
CROP_FRAC = 0.08  # remove 8% border on each side
h, w = img_rgb_small.shape[:2]
cy, cx = int(h * CROP_FRAC), int(w * CROP_FRAC)
img_rgb_crop = img_rgb_small[cy:h-cy, cx:w-cx]
```

**Why:** Without resize, IPC608 (1080p) images will score very differently from C4k0193 (4K) images on gradient metrics, because more pixels = more high-frequency content = higher Tenengrad. The 4K camera will appear 4× "sharper" than the 1080p camera even for identical water. The crop removes burned-in timestamps and depth overlays.

**Estimated effort:** Small  
**Needs recalibration:** Yes — all metric bounds change when computed on canonical resolution.

---

### Fix 7 — Run calibration on 50 images before setting normalization bounds (Small)

**File:Cell:** New calibration cell in `main.ipynb` (or separate `model/calibrate.py`)

```python
import glob, json, numpy as np

image_paths = (
    glob.glob(r"data\train\images\*.jpg")[:30] +
    glob.glob(r"data\valid\images\*.jpg")[:10] +
    glob.glob(r"data\test\images\*.jpg")[:10]
)

records = []
for p in image_paths:
    try:
        result = score_image(p)   # run the FIXED scorer (after fixes 1-6)
        records.append({
            "path": p,
            "tenengrad_raw": result["raw"]["tenengrad"],
            "dcp_raw":       result["raw"]["dark_channel"],
            "blue_dom_raw":  result["raw"]["blue_dominance"],
            "uicm_raw":      result["raw"]["uicm"],
        })
    except Exception as e:
        print(f"SKIP {p}: {e}")

import pandas as pd
df = pd.DataFrame(records)
print(df.describe(percentiles=[.05, .25, .5, .75, .95]))
# Set LOW = p5, HIGH = p95 for each metric in the normalization
```

**Why:** Every normalization constant in the current code (`/ 300.0`, `(u+10)/20`) was set by guesswork. The calibration pass defines actual p5/p95 bounds from real images, ensuring the normalized [0,1] range maps to the actual data distribution instead of a theoretical range.

**Estimated effort:** Small  
**Needs recalibration:** This IS the calibration step

---

### Fix 8 — Build batch scorer and label CSV writer (Medium)

**File:Cell:** New cell in `main.ipynb` or new `model/batch_score.py`

```python
import glob, csv, os, datetime, re

def parse_timestamp(filename):
    # Pattern: YYYYMMDD-HHMMSS-*
    m = re.match(r"(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})", os.path.basename(filename))
    if m:
        y,mo,d,h,mi,s = m.groups()
        return datetime.datetime(int(y),int(mo),int(d),int(h),int(mi),int(s))
    return None

output_rows = []
for split in ["train", "valid", "test"]:
    paths = sorted(glob.glob(f"data/{split}/images/*.jpg"))
    for p in paths:
        ts = parse_timestamp(p)
        result = score_image(p)
        output_rows.append({
            "image_path": p,
            "timestamp": ts.isoformat() if ts else "",
            "split": split,
            "clarity_score": result["clarity_score"],
            "turbidity_score": result["turbidity_score"],
            **{f"raw_{k}": v for k, v in result["raw"].items()},
        })

with open("labels/visibility_scores.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=output_rows[0].keys())
    writer.writeheader()
    writer.writerows(output_rows)
print(f"Written {len(output_rows)} rows to labels/visibility_scores.csv")
```

**Why:** Without this, the scores cannot be used as training labels. There is currently no mechanism to produce scores for all 3,568 images and store them. This is a blocking gap before any ML training can happen.

**Estimated effort:** Medium  
**Needs recalibration:** No

---

### Fix 9 — Delete dead code from unrelated experiments (Trivial)

**File:Cell:** `main.ipynb Cells 0, 1, 2, 4`

Delete or move to a separate `experiments/` notebook:
- Cells 0–1: Copernicus Marine download (Indian Ocean current data, unrelated to Piran visibility)
- Cell 2: Linux-path file extraction script (images are already in `data/`)
- Cell 4: Roboflow upload with placeholder API key

**Why:** These cells make the notebook appear to contain more than it does, confuse readers, and the Copernicus cell tries to authenticate to an external service on every kernel restart (as shown in the cell output: "Copernicus Marine username:Abort").

**Estimated effort:** Trivial  
**Needs recalibration:** No

---

## 9. Open Questions for the Human

**Q1 — Score direction.** The pipeline produces TURBIDITY (0=clear, 100=muddy). The project description says "higher = clearer." Which convention should the final training label use? Fix 5 (one line) handles this, but confirm before training.

**Q2 — What do the YOLO labels in `data/*/labels/` represent?** The label files contain YOLO object detection annotations (class_id=14 is prevalent). Are these labels for an object detection model separate from the visibility regressor? If so, the visibility scorer must generate NEW labels not present in the data. If not — if the "label" is somehow the detection result — the whole pipeline design needs revision.

**Q3 — Visual check on the 15 probe images.** Open these five in an image viewer and confirm whether the file-size-based diversity guess is correct:
```
data\train\images\20231016-173101-IPC608_8B64_165.jpg   (36KB — likely near-black)
data\train\images\20230404-120000-C4k0193.jpg           (1901KB — likely clear/4K)
data\valid\images\20231202-142401-IPC608_8B64_165.jpg   (45KB — high dark_channel)
data\test\images\20230325-180000-C4k0193.jpg            (1548KB — uicm clips)
data\test\images\20231007-090201-IPC608_8B64_165.jpg    (247KB — mid)
```
The entire discrimination analysis depends on whether "small file = muddy" holds. If small files are night images (no usable content), not muddy-water images, the calibration strategy needs adjustment.

**Q4 — What Tenengrad range do you observe on clear vs muddy images?** After running Fix 7 (calibration), report the p5/p95 of `tenengrad` for images you have manually classified as clear, mid, and muddy. Without this, the normalization bounds in Fix 2 remain guesses.

**Q5 — Timestamp coverage.** The backend FeatureRow CSV covers a single date/time per API call. The image dataset spans 2023-2024. Before Fix 8 (label-feature join) can produce a training set, you need to confirm: are there FeatureRow CSV rows for the same dates as the images? If the buoy data only covers recent months and the images cover 2023, the label-feature join will be empty.

**Q6 — Multi-image per timestamp.** Some timestamps appear multiple times (e.g., `20231002-091501-C4k0193.jpg` alongside many `20231002-*-IPC608_8B64_165.jpg`). Are these from simultaneous cameras at the same location? If so, should they be averaged to one label per timestamp, or trained as separate rows?

**Q7 — Can you share 5 manually-ranked images?** Pick 1 clearly clear, 1 clearly muddy, 3 ambiguous, rank them 0–100 subjectively. Run the current scorer on them and report the scores. This is the fastest possible sanity check for whether the dark_channel metric at least gets the direction right. Everything else in this review can be confirmed analytically, but the domain-appropriate calibration constants require human ground truth.
