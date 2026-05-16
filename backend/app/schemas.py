from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PredictionRequest(CamelModel):
    date: str
    time: str

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("date must be in YYYY-MM-DD format")
        return v

    @field_validator("time")
    @classmethod
    def validate_time(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%H:%M")
        except ValueError:
            raise ValueError("time must be in HH:MM format")
        return v


class FeatureRow(CamelModel):
    datetime: datetime
    wave_height_m: Optional[float] = None
    wave_direction_deg: Optional[float] = None
    wave_period_s: Optional[float] = None
    wave_peak_period_s: Optional[float] = None
    air_temperature_c: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    wind_direction_deg: Optional[float] = None
    cloud_cover_pct: Optional[float] = None
    humidity_pct: Optional[float] = None
    sunrise: Optional[datetime] = None
    sunset: Optional[datetime] = None
    next_tide_type: Optional[str] = None
    next_tide_height_m: Optional[float] = None
    next_tide_time: Optional[datetime] = None
    moon_phase: Optional[float] = None


class PredictionResponse(CamelModel):
    status: str
    features: FeatureRow
