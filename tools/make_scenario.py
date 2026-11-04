"""Sinh kịch bản CSV (minute,rain_mm_h,tide_m) cho device-sim từ dữ liệu thật.

Mưa: Open-Meteo Historical Weather API (https://open-meteo.com/en/docs/historical-weather-api)
Triều: mô hình điều hòa M2/S2/K1/O1 (hoặc nhập bảng triều Đài KTTV Nam Bộ).

Ví dụ:
    python3 tools/make_scenario.py --start 2025-10-01 --end 2025-10-02 -o device-sim/scenarios/real_2025_10_01.csv
"""
import argparse
import math

HCM_LAT, HCM_LON = 10.7769, 106.7009
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# (biên độ m, chu kỳ giờ, pha rad) — TODO: hiệu chỉnh theo bảng triều trạm Phú An
TIDE_CONSTITUENTS = [(0.85, 12.42, 0.0), (0.35, 12.00, 0.6), (0.55, 23.93, 1.1), (0.45, 25.82, 2.0)]
TIDE_MEAN_M = 0.5


def fetch_hourly_rain(start: str, end: str) -> list[float]:
    """TODO: gọi ARCHIVE_URL với hourly=precipitation, timezone=Asia/Ho_Chi_Minh, trả list mm/h."""
    raise NotImplementedError


def tide_at(hour: float) -> float:
    return TIDE_MEAN_M + sum(a * math.cos(2 * math.pi * hour / p + ph) for a, p, ph in TIDE_CONSTITUENTS)


def write_csv(path: str, rain_mm_h: list[float]) -> None:
    """TODO: mỗi giờ một dòng: minute=h*60, rain_mm_h, tide_at(h)."""
    raise NotImplementedError


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("-o", "--output", required=True)
    args = parser.parse_args()
    write_csv(args.output, fetch_hourly_rain(args.start, args.end))


if __name__ == "__main__":
    main()
