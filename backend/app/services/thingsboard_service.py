import asyncio
import json
import logging
import math
import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import httpx
from ..config import settings
from ..models.schemas import DeviceTelemetry, CitySummary

VN_TZ = timezone(timedelta(hours=7))
OFFLINE_AFTER_MS = 120_000  # 2 phút không có số đo mới thì coi là mất kết nối

logger = logging.getLogger(__name__)


def load_stations(path: str) -> List[dict]:
    # Dùng chung file cấu hình trạm với device-sim để không phải khai báo hai lần.
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def classify(water_cm: float) -> str:
    return ("CRITICAL" if water_cm >= 50 else "WARNING" if water_cm >= 35
            else "ALERT" if water_cm >= 20 else "SAFE")


class ThingsBoardService:
    def __init__(self, stations: Optional[List[dict]] = None):
        self.stations = stations if stations is not None else load_stations(settings.STATIONS_FILE)
        self._index = {s["device_id"]: i for i, s in enumerate(self.stations)}
        self.jwt_token: Optional[str] = None
        self.token_expiry = 0.0
        self.tb_client = httpx.AsyncClient(timeout=8.0)
        self._lock = asyncio.Lock()
        self._auth_lock = asyncio.Lock()
        self._snapshot = None
        self._expires = 0.0

    async def _get_auth_token(self) -> str:
        async with self._auth_lock:
            if self.jwt_token and time.time() < self.token_expiry:
                return self.jwt_token
            if not settings.THINGSBOARD_USERNAME or not settings.THINGSBOARD_PASSWORD:
                raise ValueError("Chưa cấu hình tài khoản ThingsBoard cho backend.")
            response = await self.tb_client.post(
                f"{settings.THINGSBOARD_URL.rstrip('/')}/api/auth/login",
                json={"username": settings.THINGSBOARD_USERNAME,
                      "password": settings.THINGSBOARD_PASSWORD})
            if response.status_code in (401, 403):
                raise ValueError("ThingsBoard từ chối tài khoản backend. Kiểm tra TB_TENANT_USER/PASSWORD.")
            response.raise_for_status()
            self.jwt_token = response.json()["token"]
            self.token_expiry = time.time() + 300
            return self.jwt_token

    async def _get(self, path):
        for attempt in range(2):
            token = await self._get_auth_token()
            response = await self.tb_client.get(
                settings.THINGSBOARD_URL.rstrip('/') + path,
                headers={"X-Authorization": f"Bearer {token}"})
            if response.status_code == 401 and attempt == 0:
                if self.jwt_token == token:
                    self.jwt_token = None
                continue
            response.raise_for_status()
            return response.json()

    @staticmethod
    def _value(data, key, default=None):
        values = data.get(key)
        return values[0].get("value", default) if isinstance(values, list) and values else default

    def _station_index(self, data, name) -> Optional[int]:
        # Trạm được nhận diện bằng device_id gửi kèm số đo, hoặc tên thiết bị trên ThingsBoard.
        logical_id = str(self._value(data, "device_id", ""))
        return self._index.get(logical_id, self._index.get(name))

    async def _read_all(self):
        devices = []
        page = 0
        while True:
            listing = await self._get(f"/api/tenant/devices?pageSize=100&page={page}")
            devices.extend(listing["data"])
            if not listing.get("hasNext", False):
                break
            page += 1
        semaphore = asyncio.Semaphore(8)

        async def read_device(device):
            async with semaphore:
                try:
                    entity_id = device["id"]["id"]
                    data = await self._get(
                        f"/api/plugins/telemetry/DEVICE/{entity_id}/values/timeseries"
                        "?keys=device_id,water_level_cm,rainfall_mm")
                    if not data.get("water_level_cm"):
                        return None
                    water = float(self._value(data, "water_level_cm"))
                    ts = int(data["water_level_cm"][0]["ts"])
                    if not math.isfinite(water) or water < 0 or ts <= 0 or ts > time.time() * 1000 + 5000:
                        raise ValueError("invalid water measurement")
                    return {"idx": self._station_index(data, device.get("name", "")),
                            "data": data, "ts": ts, "water": water}
                except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                    logger.warning("Device telemetry read failed: %s", type(exc).__name__)
                    return exc

        readings = await asyncio.gather(*(read_device(device) for device in devices))
        by_station = {}
        for r in readings:
            if isinstance(r, dict) and r["idx"] is not None:
                if r["idx"] not in by_station or r["ts"] > by_station[r["idx"]]["ts"]:
                    by_station[r["idx"]] = r
        failures = sum(isinstance(r, Exception) for r in readings)
        error = None
        if failures:
            error = f"Không đọc được telemetry của {failures}/{len(devices)} thiết bị ThingsBoard."
        elif not by_station:
            error = "ThingsBoard chưa có số đo mực nước khớp với các trạm. Kiểm tra device-sim."
        return by_station, error

    async def get_snapshot(self):
        # REST và WebSocket dùng chung một lần đọc ThingsBoard mỗi giây.
        async with self._lock:
            if self._snapshot is not None and time.monotonic() < self._expires:
                return self._snapshot
            by_station, error = {}, None
            try:
                by_station, error = await self._read_all()
            except ValueError as exc:
                error = str(exc)
                logger.warning("ThingsBoard configuration/authentication failed")
            except (httpx.HTTPError, KeyError, TypeError) as exc:
                error = "Không kết nối hoặc đọc được ThingsBoard. Kiểm tra THINGSBOARD_URL và tài khoản."
                logger.warning("ThingsBoard read failed: %s", type(exc).__name__)

            now_ms = time.time() * 1000
            results = []
            for idx, station in enumerate(self.stations):
                reading = by_station.get(idx)
                online = reading is not None and 0 <= now_ms - reading["ts"] <= OFFLINE_AFTER_MS
                rain = None
                if online:
                    try:
                        rain = float(self._value(reading["data"], "rainfall_mm"))
                        rain = rain if math.isfinite(rain) else None
                    except (TypeError, ValueError):
                        pass
                results.append(DeviceTelemetry(
                    device_id=station["device_id"],
                    name=station["device_name"],
                    station_node=station["station_node"],
                    parent_name=station["parent_name"],
                    district=station["district"],
                    latitude=station["latitude"], longitude=station["longitude"],
                    water_level_cm=reading["water"] if online else None,
                    rainfall_mm=rain,
                    status=classify(reading["water"]) if online else "OFFLINE",
                    updated_at=(datetime.fromtimestamp(reading["ts"] / 1000, tz=VN_TZ)
                                .strftime("%Y-%m-%d %H:%M:%S")) if reading else "Chưa có dữ liệu",
                    error=None if online else (error or ("Không nhận số đo trong 2 phút." if reading
                                                         else "Trạm chưa gửi số đo."))))

            if not error and all(d.status == "OFFLINE" for d in results):
                error = "Tất cả trạm đã mất kết nối quá 2 phút. Kiểm tra device-sim và MQTT."
            self._snapshot = (results, error)
            self._expires = time.monotonic() + 1.0
            return self._snapshot

    async def get_live_devices(self) -> List[DeviceTelemetry]:
        return (await self.get_snapshot())[0]

    @staticmethod
    def get_city_summary(devices: List[DeviceTelemetry]) -> CitySummary:
        active = [d for d in devices if d.status != "OFFLINE"]
        rains = [d.rainfall_mm for d in active if d.rainfall_mm is not None]
        return CitySummary(
            safe_count=sum(d.status == "SAFE" for d in active),
            alert_count=sum(d.status in ("ALERT", "WARNING") for d in active),
            critical_count=sum(d.status == "CRITICAL" for d in active),
            avg_water_level_cm=round(sum(d.water_level_cm for d in active) / len(active), 1) if active else None,
            avg_rainfall_mm_h=round(sum(rains) / len(rains), 1) if rains else None,
            total_active_devices=len(active),
            total_devices=len(devices))


tb_service = ThingsBoardService()
