from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    site_lat: float = 45.5482
    site_lng: float = 13.7296
    site_timezone: str = "Europe/Ljubljana"
    stormglass_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
