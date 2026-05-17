import math
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import xgboost as xgb

_MODEL_PATH = Path(__file__).parent.parent / "visibility_model.json"

_MODEL = xgb.Booster()
_MODEL.load_model(str(_MODEL_PATH))

_FEATURE_NAMES = _MODEL.feature_names


def _daylight_features(target: datetime, sunrise: Optional[datetime], sunset: Optional[datetime]) -> dict:
    if sunrise is None or sunset is None:
        return {
            "daylight_duration_mins": float("nan"),
            "mins_since_sunrise": float("nan"),
            "mins_until_sunset": float("nan"),
            "is_daylight": float("nan"),
        }
    daylight = (sunset - sunrise).total_seconds() / 60.0
    since_sunrise = max(0.0, (target - sunrise).total_seconds() / 60.0)
    until_sunset = max(0.0, (sunset - target).total_seconds() / 60.0)
    is_daylight = 1.0 if sunrise <= target <= sunset else 0.0
    return {
        "daylight_duration_mins": daylight,
        "mins_since_sunrise": since_sunrise,
        "mins_until_sunset": until_sunset,
        "is_daylight": is_daylight,
    }


def _cyclical_time_features(target: datetime) -> dict:
    day = target.timetuple().tm_yday
    hour = target.hour + target.minute / 60.0
    return {
        "day_sin": math.sin(2 * math.pi * day / 365.25),
        "day_cos": math.cos(2 * math.pi * day / 365.25),
        "time_sin": math.sin(2 * math.pi * hour / 24.0),
        "time_cos": math.cos(2 * math.pi * hour / 24.0),
    }


def _f(value) -> float:
    return float("nan") if value is None else float(value)


def predict_visibility(
    target: datetime,
    lat: float,
    lng: float,
    depth_m: float,
    features: dict,
) -> float:
    daylight = _daylight_features(target, features.get("sunrise"), features.get("sunset"))
    cyclic = _cyclical_time_features(target)

    row = {
        "Longitude": _f(lng),
        "Latitude": _f(lat),
        "Depth(m)": _f(depth_m),
        "depth_m": _f(depth_m),
        "wave_height_m": _f(features.get("wave_height_m")),
        "wave_direction_deg": _f(features.get("wave_direction_deg")),
        "wave_period_s": _f(features.get("wave_period_s")),
        "wave_peak_period_s": _f(features.get("wave_peak_period_s")),
        "sea_surface_temperature_c": _f(features.get("water_temperature_c")),
        "air_temperature_c": _f(features.get("air_temperature_c")),
        "wind_speed_kmh": _f(features.get("wind_speed_kmh")),
        "wind_direction_deg": _f(features.get("wind_direction_deg")),
        "cloud_cover_pct": _f(features.get("cloud_cover_pct")),
        "humidity_pct": _f(features.get("humidity_pct")),
        "moon_phase": _f(features.get("moon_phase")),
        **{k: _f(v) for k, v in daylight.items()},
        **cyclic,
    }

    vector = np.array([[row[name] for name in _FEATURE_NAMES]], dtype=np.float32)
    dmatrix = xgb.DMatrix(vector, feature_names=_FEATURE_NAMES)
    score = float(_MODEL.predict(dmatrix)[0])
    return score


def status_from_score(score: float) -> dict:
    if score < 40:
        return {"label": "Excellent", "tone": "good"}
    if score < 60:
        return {"label": "Moderate", "tone": "marginal"}
    return {"label": "Challenging", "tone": "marginal"}
