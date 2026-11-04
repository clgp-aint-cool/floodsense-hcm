#pragma once

#include <cstdint>

namespace flood {

enum class FloodStatus : uint8_t { Safe, Alert, Warning, Critical, SensorFault };

const char* toString(FloodStatus status);

// Ngưỡng mực nước (cm). Khớp với backend: ALERT 20, WARNING 35, CRITICAL 50.
// Có thể đổi từ xa qua shared attributes của ThingsBoard.
struct Thresholds {
    float alertCm = 20.0f;
    float warningCm = 35.0f;
    float criticalCm = 50.0f;
    float hysteresisCm = 2.0f;  // tránh nhấp nháy trạng thái quanh ngưỡng
};

// Chu kỳ gửi dữ liệu theo mức ngập (giây). Ngập càng nặng gửi càng dày.
// SAFE phải < 60 s vì backend coi trạm OFFLINE nếu quá 60 s không có dữ liệu.
struct ReportIntervals {
    uint32_t safeSec = 30;
    uint32_t alertSec = 10;
    uint32_t warningSec = 5;
    uint32_t criticalSec = 2;
};

struct StationSettings {
    float mountHeightCm = 200.0f;  // khoảng cách từ cảm biến siêu âm tới mặt đường khô
    Thresholds thresholds;
    ReportIntervals intervals;
};

// Một mẫu đo đã xử lý, sẵn sàng gửi lên ThingsBoard.
struct Telemetry {
    uint64_t timestampMs = 0;
    float waterLevelCm = 0.0f;
    float distanceRawCm = 0.0f;
    float rainfallMm = 0.0f;       // lượng mưa tích lũy kể từ lần gửi trước
    float rainRateMmH = 0.0f;      // cường độ mưa trung bình kể từ lần gửi trước
    bool sensorFault = false;
    FloodStatus status = FloodStatus::Safe;
};

}  // namespace flood
