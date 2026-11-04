import math
from datetime import datetime
from typing import List, Optional
from ..models.schemas import TideStation, TideHourlyPoint

class TideService:
    unavailable_reason: Optional[str] = None

    # Hệ thống 10 trạm thủy văn quan trắc ngập triều toàn diện trên địa bàn TP.HCM
    STATIONS_CONFIG = [
        {
            "station_id": "phu_an",
            "name": "Trạm Phú An (Sông Sài Gòn - Q.1 / Bình Thạnh)",
            "base": 0.90, "amp1": 0.58, "shift1": 5.0, "amp2": 0.12, "shift2": 2.0,
            "min_val": 0.40, "warn": 1.25, "high": 1.45, "crit": 1.60
        },
        {
            "station_id": "nha_be",
            "name": "Trạm Nhà Bè (Ngã ba sông Đồng Điền - Lòng Tàu)",
            "base": 0.88, "amp1": 0.54, "shift1": 4.5, "amp2": 0.10, "shift2": 1.5,
            "min_val": 0.35, "warn": 1.20, "high": 1.40, "crit": 1.55
        },
        {
            "station_id": "cat_lai",
            "name": "Trạm Cát Lái (Sông Đồng Nai - TP. Thủ Đức)",
            "base": 0.92, "amp1": 0.56, "shift1": 4.6, "amp2": 0.11, "shift2": 1.6,
            "min_val": 0.38, "warn": 1.22, "high": 1.42, "crit": 1.58
        },
        {
            "station_id": "nhieu_loc",
            "name": "Trạm Kênh Nhiêu Lộc - Thị Nghè (Lưu vực Trung tâm)",
            "base": 0.78, "amp1": 0.44, "shift1": 5.3, "amp2": 0.09, "shift2": 2.3,
            "min_val": 0.30, "warn": 1.15, "high": 1.35, "crit": 1.50
        },
        {
            "station_id": "kenh_doi",
            "name": "Trạm Kênh Đôi - Kênh Tẻ (Chợ Lớn - Quận 8)",
            "base": 0.91, "amp1": 0.55, "shift1": 4.9, "amp2": 0.11, "shift2": 1.9,
            "min_val": 0.35, "warn": 1.20, "high": 1.40, "crit": 1.55
        },
        {
            "station_id": "soai_rap",
            "name": "Trạm Rạch Đĩa - Soài Rạp (Quận 7 - Nhà Bè)",
            "base": 0.93, "amp1": 0.57, "shift1": 4.6, "amp2": 0.11, "shift2": 1.6,
            "min_val": 0.36, "warn": 1.22, "high": 1.42, "crit": 1.58
        },
        {
            "station_id": "tham_luong",
            "name": "Trạm Tham Lương - Bến Cát (Q.12 - Gò Vấp - Tân Bình)",
            "base": 0.75, "amp1": 0.42, "shift1": 5.5, "amp2": 0.08, "shift2": 2.5,
            "min_val": 0.28, "warn": 1.10, "high": 1.30, "crit": 1.48
        },
        {
            "station_id": "ben_nghe",
            "name": "Trạm Rạch Bến Nghé - Tàu Hủ (Quận 1 - Quận 4)",
            "base": 0.89, "amp1": 0.53, "shift1": 5.1, "amp2": 0.10, "shift2": 2.1,
            "min_val": 0.35, "warn": 1.20, "high": 1.40, "crit": 1.55
        },
        {
            "station_id": "cho_dem",
            "name": "Trạm Sông Chợ Đệm - Cần Giuộc (Bình Chánh)",
            "base": 0.85, "amp1": 0.50, "shift1": 4.8, "amp2": 0.09, "shift2": 1.8,
            "min_val": 0.32, "warn": 1.18, "high": 1.38, "crit": 1.52
        },
        {
            "station_id": "rach_chiec",
            "name": "Trạm Rạch Chiếc - Giồng Ông Tố (TP. Thủ Đức)",
            "base": 0.87, "amp1": 0.52, "shift1": 4.7, "amp2": 0.10, "shift2": 1.7,
            "min_val": 0.34, "warn": 1.20, "high": 1.40, "crit": 1.54
        }
    ]

    @classmethod
    async def get_tide_data(cls) -> List[TideStation]:
        now = datetime.now()
        current_hour = now.hour
        results: List[TideStation] = []

        for st in cls.STATIONS_CONFIG:
            hourly_points: List[TideHourlyPoint] = []
            for h in range(25):
                val = (st["base"] + 
                       st["amp1"] * math.sin((h - st["shift1"]) * math.pi / 6) + 
                       st["amp2"] * math.sin((h - st["shift2"]) * math.pi / 3))
                hourly_points.append(TideHourlyPoint(hour=h, level=round(max(st["min_val"], val), 2)))

            current_lvl = hourly_points[current_hour].level
            peak_lvl = max(p.level for p in hourly_points)
            peak_h = next(p.hour for p in hourly_points if p.level == peak_lvl)
            trend = "UP" if current_hour < peak_h else "DOWN"
            
            if current_lvl >= st["crit"]:
                status = "CRITICAL"
            elif current_lvl >= st["high"]:
                status = "HIGH"
            elif current_lvl >= st["warn"]:
                status = "WARNING"
            else:
                status = "STABLE"

            results.append(TideStation(
                station_id=st["station_id"],
                name=st["name"],
                current_level=current_lvl,
                trend=trend,
                status=status,
                peak_level=peak_lvl,
                peak_hour=peak_h,
                hourly_data=hourly_points
            ))

        return results
