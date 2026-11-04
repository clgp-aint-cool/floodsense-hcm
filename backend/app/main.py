import asyncio
import json
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models.schemas import DashboardData, WeatherData
from .services.tide_service import TideService
from .services.weather_service import WeatherService
from .services.thingsboard_service import tb_service

VN_TZ = timezone(timedelta(hours=7))

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend microservice kết nối ThingsBoard IoT, Open-Meteo và đẩy dữ liệu cho Web HCM Flood Tracker",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/healthz")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}

async def build_dashboard_data() -> DashboardData:
    devices, telemetry_error = await tb_service.get_snapshot()
    errors = {}
    if TideService.unavailable_reason:
        errors["tides"] = TideService.unavailable_reason
    if telemetry_error:
        errors["telemetry"] = telemetry_error
    summary = tb_service.get_city_summary(devices)
    tides = await TideService.get_tide_data()
    severe = tb_service.get_severe_locations(devices)
    roads = tb_service.get_flooded_roads(devices)
    zones = tb_service.get_flood_zones(devices)
    weather_raw = await WeatherService.get_current_weather()
    weather = WeatherData(**weather_raw)
    if weather.error:
        errors["weather"] = weather.error
    
    return DashboardData(
        timestamp=datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        summary=summary,
        tides=tides,
        severe_locations=severe,
        devices=devices,
        roads=roads,
        zones=zones,
        errors=errors,
        weather=weather
    )

@app.get("/api/v1/dashboard", response_model=DashboardData)
async def get_dashboard():
    return await build_dashboard_data()

@app.get("/api/v1/roads")
async def get_roads():
    devices = await tb_service.get_live_devices()
    return tb_service.get_flooded_roads(devices)

@app.get("/api/v1/zones")
async def get_zones():
    devices = await tb_service.get_live_devices()
    return tb_service.get_flood_zones(devices)

@app.get("/api/v1/tides")
async def get_tides():
    return await TideService.get_tide_data()

@app.get("/api/v1/weather")
async def get_weather():
    return await WeatherService.get_current_weather()

@app.get("/api/v1/devices")
async def get_devices():
    return await tb_service.get_live_devices()

@app.get("/api/v1/severe-locations")
async def get_severe_locations():
    devices = await tb_service.get_live_devices()
    return tb_service.get_severe_locations(devices)

@app.websocket("/ws/live")
async def websocket_live_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await build_dashboard_data()
            await websocket.send_text(data.model_dump_json())
            await asyncio.sleep(1.0)  # Cập nhật mỗi 1 giây cho frontend
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS error: {e}")
