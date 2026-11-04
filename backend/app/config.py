import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "HCM Flood Tracker API"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # ThingsBoard Connection
    THINGSBOARD_URL: str = os.getenv("THINGSBOARD_URL", "http://localhost:8080")
    THINGSBOARD_USERNAME: str = os.getenv("THINGSBOARD_USERNAME", "")
    THINGSBOARD_PASSWORD: str = os.getenv("THINGSBOARD_PASSWORD", "")
    
    # HCMC Geographical reference
    HCMC_LAT: float = 10.7769
    HCMC_LON: float = 106.7009
    
    # External APIs
    OPEN_METEO_WEATHER_URL: str = "https://api.open-meteo.com/v1/forecast"
    MET_NORWAY_WEATHER_URL: str = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
    OPEN_METEO_MARINE_URL: str = "https://marine-api.open-meteo.com/v1/marine"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
