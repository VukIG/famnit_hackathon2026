"""
merge_piran_training_table.py

Joins every available data layer into one daily training table.

  Required inputs:
    - piran_features_daily_v2.csv   (satellite,    from Pass 1)
    - piran_atmospheric_daily.csv   (atmospheric,  from Pass 2)

  Optional inputs (auto-detected, silently skipped if missing):
    - sensor_daily.csv              (buoy sensor aggregates — provide your own)
    - image_blur_scores.csv         (target — provide your own; needs `date` + a target col)

  Outputs:
    - piran_training_table.csv              (everything joined on `date`)
    - piran_training_table_image_range.csv  (only dates with target value, if target provided)

Usage:
    python merge_piran_training_table.py
"""

from pathlib import Path
import pandas as pd

# =============================================================================
# CONFIG
# =============================================================================

SATELLITE = Path("piran_features_daily_v2.csv")
ATMOS     = Path("piran_atmospheric_daily.csv")
SENSOR    = Path("sensor_daily.csv")              # optional
TARGET    = Path("image_blur_scores.csv")         # optional

OUT_FULL  = Path("piran_training_table.csv")
OUT_IMG   = Path("piran_training_table_image_range.csv")

# Common names for the target column; auto-detect from the image file
TARGET_HINTS = ("blur_score", "visibility_score", "visibility",
                "target", "y", "blur", "score")


# =============================================================================
# UTILITIES
# =============================================================================

def load_with_date(path):
    df = pd.read_csv(path)
    if "date" not in df.columns:
        raise ValueError(f"{path} has no `date` column")
    df["date"] = pd.to_datetime(df["date"]).dt.date
    return df


def summary(df, name):
    print(f"  [{name:<14s}] {len(df):>4d} rows, {len(df.columns):>4d} cols, "
          f"{df['date'].min()} -> {df['date'].max()}")


def find_target_col(df):
    cand = [c for c in df.columns if c != "date" and c.lower() in TARGET_HINTS]
    if cand:
        return cand[0]
    non_date = [c for c in df.columns if c != "date"]
    if len(non_date) == 1:
        return non_date[0]   # single non-date column is the target
    return None


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("[1/4] required layers")
    if not SATELLITE.exists():
        raise FileNotFoundError(f"missing {SATELLITE} — run extract_piran_copernicus_v2.py first")
    if not ATMOS.exists():
        raise FileNotFoundError(f"missing {ATMOS} — run extract_piran_atmospheric_v1.py first")

    sat = load_with_date(SATELLITE); summary(sat, "satellite")
    atm = load_with_date(ATMOS);     summary(atm, "atmospheric")

    print("\n[2/4] base merge (satellite + atmospheric)")
    df = sat.merge(atm, on="date", how="outer", suffixes=("", "_dup"))
    df = df.loc[:, ~df.columns.str.endswith("_dup")]
    summary(df, "base merged")

    print("\n[3/4] optional layers")
    if SENSOR.exists():
        sens = load_with_date(SENSOR); summary(sens, "sensor")
        df = df.merge(sens, on="date", how="left", suffixes=("", "_sensor"))
        df = df.loc[:, ~df.columns.str.endswith("_sensor")]
        print(f"      sensor merged -> {len(df.columns)} total cols")
    else:
        print(f"      [skip] no {SENSOR.name} found")

    target_col = None
    if TARGET.exists():
        tgt = load_with_date(TARGET); summary(tgt, "image target")
        target_col = find_target_col(tgt)
        if not target_col:
            print(f"      [warn] couldn't identify a target column in {TARGET.name}; merging anyway")
        else:
            print(f"      target column detected: '{target_col}'")
        df = df.merge(tgt, on="date", how="left", suffixes=("", "_tgt"))
        df = df.loc[:, ~df.columns.str.endswith("_tgt")]
    else:
        print(f"      [skip] no {TARGET.name} found (training table will have no y)")

    print("\n[4/4] writing")
    df = df.sort_values("date").reset_index(drop=True)
    df.to_csv(OUT_FULL, index=False)
    print(f"  -> {OUT_FULL}: {len(df)} rows, {len(df.columns)} cols")

    if target_col and target_col in df.columns:
        img = df[df[target_col].notna()].copy()
        img.to_csv(OUT_IMG, index=False)
        print(f"  -> {OUT_IMG}: {len(img)} rows (rows with target only)")
        print(f"        target range: {img[target_col].min():.3f} -> {img[target_col].max():.3f}")

    nan_pct = df.isna().mean() * 100
    print(f"\n  mean NaN across all columns: {nan_pct.mean():.1f}%")
    print(f"  columns with >50% NaN: {(nan_pct > 50).sum()}")
    print(f"\nDone. Hand the table to your ML pipeline.")


if __name__ == "__main__":
    main()
