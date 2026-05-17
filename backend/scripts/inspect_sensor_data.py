"""Quick visual + numerical inspection of generated sensor data."""
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

CSV   = Path("backend/data/synthetic_sensor_data.csv")
IMAGES = Path("backend/dataset/input.csv")

df = pd.read_csv(CSV, parse_dates=["datetime"])
print(f"Rows: {len(df)}, Columns: {len(df.columns)}")
print(f"Columns: {list(df.columns)}\n")
print(f"Date range: {df.datetime.min()} -> {df.datetime.max()}\n")
print("Sensor stats:")
print(df[["turbidity_ntu", "salinity_psu"]].describe().round(2))
print(f"\nMissing data: turbidity {df.turbidity_ntu.isna().mean()*100:.1f}%, salinity {df.salinity_psu.isna().mean()*100:.1f}%")

# Find plume events (where salinity dropped meaningfully)
in_plume = df.salinity_psu < 34
plume_starts = in_plume & ~in_plume.shift(1, fill_value=False)
print(f"\nDetected plume events: {plume_starts.sum()}")
for ts in df.loc[plume_starts, "datetime"].head(10):
    print(f"  {ts}")

# Plot a 3-week window around the first plume
if plume_starts.any():
    idx = df.index[plume_starts][0]
    start, end = max(0, idx - 7*24), min(len(df), idx + 14*24)
    sample = df.iloc[start:end]
else:
    sample = df.iloc[len(df)//2 : len(df)//2 + 30*24]

fig, axes = plt.subplots(3, 1, figsize=(14, 8), sharex=True)
axes[0].plot(sample.datetime, sample.turbidity_ntu, color="#1D9E75")
axes[0].set_ylabel("Turbidity (NTU)")
axes[0].set_title("3-week window around first plume event")
axes[1].plot(sample.datetime, sample.salinity_psu, color="#185FA5")
axes[1].axhline(37, color="gray", linestyle="--", alpha=0.5)
axes[1].set_ylabel("Salinity (PSU)")
if "wave_height_m" in df.columns:
    axes[2].plot(sample.datetime, sample.wave_height_m, color="#888780", alpha=0.7)
    axes[2].set_ylabel("Wave height (m)")
axes[2].set_xlabel("Time")
plt.tight_layout()
plt.savefig("backend/data/inspection_sample.png", dpi=100)
print(f"\nSaved 3-week sample plot to backend/data/inspection_sample.png")

# Confirm the join with input.csv works
if IMAGES.exists():
    img = pd.read_csv(IMAGES)
    img["datetime"] = pd.to_datetime(img.Date + " " + img.Time, dayfirst=True).dt.floor("h")
    joined = img.merge(df, on="datetime", how="left")
    matched = joined.turbidity_ntu.notna().sum()
    print(f"\nImage-to-sensor join: {matched} / {len(img)} images matched ({matched/len(img)*100:.1f}%)")
    if matched < len(img):
        miss = joined[joined.turbidity_ntu.isna()][["Filename","Date","Time"]].head()
        print("First 5 unmatched:")
        print(miss.to_string(index=False))