import asyncio
from datetime import datetime

from app.schemas import FeatureRow
from app.services.astronomy import get_moon_phase
from app.services.marine import fetch_wave_data
from app.services.tides import fetch_next_tide
from app.services.weather import fetch_weather


# Calls all external sources in parallel and assembles the feature row.
async def build_feature_row(target: datetime) -> FeatureRow:
    wave_data, weather_data, tide_data = await asyncio.gather(
        fetch_wave_data(target),
        fetch_weather(target),
        fetch_next_tide(target),
    )

    moon_phase = get_moon_phase(target)

    return FeatureRow(
        datetime=target,
        **wave_data,
        **weather_data,
        **tide_data,
        moon_phase=moon_phase,
    )
