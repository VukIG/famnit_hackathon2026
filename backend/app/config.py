from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    site_lat: float = 45.5482
    site_lng: float = 13.7296
    site_timezone: str = "Europe/Ljubljana"
    worldtides_api_key: str = ""
    site_depth_m: float = 22.0

    # --- Copernicus Marine ---
    copernicusmarine_service_username: str = ""
    copernicusmarine_service_password: str = ""

    # --- Firebase RTDB ---
    firebase_db_url: str = ""
    firebase_db_auth: str = ""

    # --- Local data storage ---
    data_dir: str = "data/copernicus"

    # --- Fixed expedition site for Copernicus queries (Cape Madona / Piran) ---
    site_latitude: float = 45.52
    site_longitude: float = 13.57
    site_depth_min: float = 18.0
    site_depth_max: float = 22.0
    site_bbox_pad: float = 0.04

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
