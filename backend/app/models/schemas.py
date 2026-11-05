from typing import List, Optional
from pydantic import BaseModel, Field


class DeviceTelemetry(BaseModel):
    device_id: str
    name: str
    station_node: str
    parent_name: str
    district: str
    latitude: float
    longitude: float
    water_level_cm: Optional[float] = None
    rainfall_mm: Optional[float] = None  # cường độ mưa mm/h đo bằng gáo lật
    status: str  # SAFE, ALERT, WARNING, CRITICAL, OFFLINE
    updated_at: str
    error: Optional[str] = None


class CitySummary(BaseModel):
    safe_count: int
    alert_count: int
    critical_count: int
    avg_water_level_cm: Optional[float] = None
    avg_rainfall_mm_h: Optional[float] = None
    total_active_devices: int
    total_devices: int


class DashboardData(BaseModel):
    timestamp: str
    summary: CitySummary
    devices: List[DeviceTelemetry]
    errors: dict[str, str] = Field(default_factory=dict)
