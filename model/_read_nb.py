import json, sys

path = r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model\main.ipynb"
nb = json.load(open(path, encoding="utf-8"))
for i, c in enumerate(nb["cells"]):
    src = "".join(c["source"])
    print(f"=== Cell {i} ({c['cell_type']}) ===")
    print(src[:600])
    print()
