import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Mặc định đọc file trạm của device-sim khi chạy từ mã nguồn; Docker mount file vào /app/stations.json.
DEFAULT_STATIONS_FILE = Path(__file__).resolve().parents[2] / "device-sim" / "config" / "stations.json"


class Settings(BaseSettings):
    APP_NAME: str = "FloodSense HCM API"
    APP_ENV: str = os.getenv("APP_ENV", "development")

    # ThingsBoard Connection
    THINGSBOARD_URL: str = os.getenv("THINGSBOARD_URL", "http://localhost:8080")
    THINGSBOARD_USERNAME: str = os.getenv("THINGSBOARD_USERNAME", "")
    THINGSBOARD_PASSWORD: str = os.getenv("THINGSBOARD_PASSWORD", "")

    STATIONS_FILE: str = os.getenv("STATIONS_FILE", str(DEFAULT_STATIONS_FILE))

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
