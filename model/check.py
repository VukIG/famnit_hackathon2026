import sys, csv
from pathlib import Path
from scorer import score_image

list_file = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("selected.txt")
out_file = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("check_results.csv")

if not list_file.exists():
    print(f"ERROR: list file not found: {list_file.resolve()}")
    sys.exit(1)

paths = [
    line.strip() for line in list_file.read_text(encoding="utf-8").splitlines()
    if line.strip() and not line.strip().startswith("#")
]

if not paths:
    print(f"ERROR: {list_file} has no image paths (after stripping blanks and # comments)")
    sys.exit(1)

print(f"Loaded {len(paths)} paths from {list_file}")

rows = []
for p in paths:
    if not Path(p).exists():
        print(f"  MISSING FILE: {p}")
        rows.append({"image": p, "clarity": None, "turbidity": None,
                     "dcp_score": None, "tenengrad_score": None,
                     "blue_dom_score": None, "uicm_score": None,
                     "unscoreable_reason": "file not found"})
        continue
    try:
        r = score_image(p)
        rows.append({
            "image": p,
            "clarity": r.get("clarity_score"),
            "turbidity": r.get("turbidity_score"),
            "dcp_score": r.get("dcp_score"),
            "tenengrad_score": r.get("tenengrad_score"),
            "blue_dom_score": r.get("blue_dom_score"),
            "uicm_score": r.get("uicm_score"),
            "unscoreable_reason": r.get("unscoreable_reason", ""),
        })
        print(f"  {p}  clarity={r.get('clarity_score')}")
    except Exception as e:
        rows.append({"image": p, "clarity": None, "turbidity": None,
                     "dcp_score": None, "tenengrad_score": None,
                     "blue_dom_score": None, "uicm_score": None,
                     "unscoreable_reason": f"ERROR: {e}"})
        print(f"  {p}  ERROR: {e}")

rows.sort(key=lambda r: (r["clarity"] is None, -(r["clarity"] or 0)))

out_file.parent.mkdir(parents=True, exist_ok=True)
with out_file.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print(f"\nWrote {len(rows)} rows to {out_file.resolve()}")