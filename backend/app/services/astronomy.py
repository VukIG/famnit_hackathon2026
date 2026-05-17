from datetime import datetime

from astral import moon


# Returns the moon phase as a fraction 0..1 (0=new, 0.5=full).
def get_moon_phase(target: datetime) -> float:
    return moon.phase(target.date()) / 28
