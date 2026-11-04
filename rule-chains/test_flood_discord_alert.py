"""Utility script to test and trigger ThingsBoard Flood Alerts to Discord webhook."""
import argparse
import os
import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta

VN_TZ = timezone(timedelta(hours=7))

DEFAULT_WEBHOOK = os.getenv("DISCORD_WEBHOOK_URL", "")


def send_alert(webhook_url: str, station_name: str, water_level: float, rainfall: float, status: str = "critical") -> bool:
    now_vn = datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S")
    iso_time = datetime.now(timezone.utc).isoformat()

    if status.lower() == "critical":
        color = 15158332  # Red
        content = "🚨 **[THINGSBOARD ALARM] CẢNH BÁO MỰC NƯỚC NGUY HIỂM** 🚨"
        severity_label = "CRITICAL (Báo động đỏ)"
        desc = "Hệ thống ThingsBoard IoT vừa phát hiện mực nước vượt ngưỡng báo động khẩn cấp!"
    elif status.lower() == "warning":
        color = 15105570  # Orange
        content = "⚠️ **[THINGSBOARD ALARM] CẢNH BÁO MỰC NƯỚC DÂNG CAO** ⚠️"
        severity_label = "WARNING (Cảnh báo cam)"
        desc = "Mực nước tại trạm đang dâng cao, tiếp cận ngưỡng nguy hiểm!"
    else:
        color = 3066993  # Green
        content = "✅ **[THINGSBOARD ALARM] MỰC NƯỚC ĐÃ HẠ / BÌNH THƯỜNG** ✅"
        severity_label = "RESOLVED / NORMAL (Bình thường)"
        desc = "Mực nước tại trạm đã rút xuống dưới ngưỡng cảnh báo an toàn."

    payload = {
        "content": content,
        "embeds": [
            {
                "title": f"Trạm quan trắc: {station_name}",
                "description": desc,
                "color": color,
                "fields": [
                    {"name": "📍 Trạm / Thiết bị", "value": f"`{station_name}`", "inline": True},
                    {"name": "⚠️ Mức độ", "value": f"**{severity_label}**", "inline": True},
                    {"name": "🌊 Mực nước đo được", "value": f"**{water_level:.1f} cm**", "inline": True},
                    {"name": "🌧️ Lượng mưa", "value": f"{rainfall:.1f} mm", "inline": True},
                    {"name": "⚡ Ngưỡng cảnh báo", "value": "≥ 50 cm (Ngập nghiêm trọng)", "inline": True},
                    {"name": "🕒 Thời gian", "value": f"{now_vn} (VN)", "inline": True},
                ],
                "footer": {
                    "text": "ThingsBoard IoT Rule Engine • HCM Smart Flood Monitor",
                    "icon_url": "https://thingsboard.io/images/thingsboard_logo.png",
                },
                "timestamp": iso_time,
            }
        ],
    }

    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "HCMFlood-ThingsBoard/1.0"},
    )

    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[SUCCESS] Alert sent to Discord with status: {resp.status}")
            return True
    except Exception as exc:
        print(f"[ERROR] Failed to send Discord alert: {exc}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--webhook", default=DEFAULT_WEBHOOK, help="Discord Webhook URL")
    parser.add_argument("--station", default="VN-HCM-001 - Bến Bạch Đằng, Quận 1", help="Station name")
    parser.add_argument("--water-level", type=float, default=58.5, help="Water level in cm")
    parser.add_argument("--rain", type=float, default=45.0, help="Rainfall in mm")
    parser.add_argument("--status", choices=["critical", "warning", "resolved"], default="critical", help="Alert severity")
    args = parser.parse_args()
    if not args.webhook:
        parser.error("Set DISCORD_WEBHOOK_URL or pass --webhook")

    send_alert(args.webhook, args.station, args.water_level, args.rain, args.status)


if __name__ == "__main__":
    main()
