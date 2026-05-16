import sys, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model")
from scorer import score_image, reload_calibration, is_scoreable, load_image
import numpy as np, cv2
from PIL import Image

reload_calibration()

tests = [
    (1,  r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model\data\train\images\20231016-173101-IPC608_8B64_165.jpg", "UNSCOREABLE"),
    (5,  r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model\data\train\images\20230404-120000-C4k0193.jpg", "clarity>70"),
    (11, r"D:\Projects\GDG-Hackathon\famnit_hackathon2026\model\data\test\images\20240229-132001-IPC608_8B64_165.jpg", "clarity<40"),
]
for idx, path, target in tests:
    r = score_image(path)
    try:
        img_arr = np.array(Image.open(path))
        gray = cv2.cvtColor(img_arr, cv2.COLOR_RGB2GRAY).astype(np.float32)
        mean_lum = gray.mean()
        std_lum  = gray.std()
    except Exception as e:
        mean_lum = std_lum = -1
    print(f"Image #{idx} target={target}")
    print(f"  clarity={r['clarity_score']}  turb={r['turbidity_score']}")
    print(f"  unscoreable={r['unscoreable_reason']}")
    print(f"  mean_lum={mean_lum:.1f}  std_lum={std_lum:.1f}")
    print(f"  raw={r['metrics_raw']}")
    print(f"  scores={r['metrics_score']}")
    print()
