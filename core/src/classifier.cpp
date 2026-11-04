#include "flood/classifier.hpp"

namespace flood {

const char* toString(FloodStatus status) {
    switch (status) {
        case FloodStatus::Safe: return "SAFE";
        case FloodStatus::Alert: return "ALERT";
        case FloodStatus::Warning: return "WARNING";
        case FloodStatus::Critical: return "CRITICAL";
        case FloodStatus::SensorFault: return "SENSOR_FAULT";
    }
    return "UNKNOWN";
}

namespace {

int level(FloodStatus s) {
    switch (s) {
        case FloodStatus::Alert: return 1;
        case FloodStatus::Warning: return 2;
        case FloodStatus::Critical: return 3;
        default: return 0;
    }
}

FloodStatus fromLevel(int l) {
    static constexpr FloodStatus kByLevel[] = {FloodStatus::Safe, FloodStatus::Alert,
                                               FloodStatus::Warning, FloodStatus::Critical};
    return kByLevel[l];
}

int rawLevel(float cm, const Thresholds& t) {
    if (cm >= t.criticalCm) return 3;
    if (cm >= t.warningCm) return 2;
    if (cm >= t.alertCm) return 1;
    return 0;
}

}  // namespace

FloodStatus classify(float waterLevelCm, const Thresholds& t, FloodStatus previous) {
    const int raw = rawLevel(waterLevelCm, t);
    const int prev = level(previous);
    if (raw >= prev) return fromLevel(raw);
    // Chỉ hạ cấp khi nước đã rút xuống dưới ngưỡng hiện tại một khoảng hysteresis.
    return fromLevel(rawLevel(waterLevelCm + t.hysteresisCm, t));
}

uint32_t reportIntervalSec(FloodStatus status, const ReportIntervals& i) {
    switch (status) {
        case FloodStatus::Critical:
        case FloodStatus::SensorFault: return i.criticalSec;
        case FloodStatus::Warning: return i.warningSec;
        case FloodStatus::Alert: return i.alertSec;
        case FloodStatus::Safe: return i.safeSec;
    }
    return i.safeSec;
}

}  // namespace flood
