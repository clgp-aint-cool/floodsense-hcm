import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models.schemas import DashboardData
from .services.thingsboard_service import tb_service

VN_TZ = timezone(timedelta(hours=7))

app = FastAPI(
    title=settings.APP_NAME,
    description="Đọc số đo các trạm từ ThingsBoard và đẩy cho web bản đồ FloodSense HCM",
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
    return DashboardData(
        timestamp=datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        summary=tb_service.get_city_summary(devices),
        devices=devices,
        errors={"telemetry": telemetry_error} if telemetry_error else {},
    )


@app.get("/api/v1/dashboard", response_model=DashboardData)
async def get_dashboard():
    return await build_dashboard_data()


@app.get("/api/v1/devices")
async def get_devices():
    return await tb_service.get_live_devices()


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
