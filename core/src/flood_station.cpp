#include "flood/flood_station.hpp"

#include <algorithm>

#include "flood/classifier.hpp"

namespace flood {

namespace {
constexpr int kMaxReadErrors = 5;  // số lần đọc siêu âm timeout liên tiếp thì coi là lỗi cảm biến
}  // namespace

FloodStation::FloodStation(StationHardware hw, StationSettings settings)
    : hw_(hw), settings_(settings) {}

void FloodStation::sample() {
    if (auto d = hw_.distance.readDistanceCm()) {
        consecutiveReadErrors_ = 0;
        distanceRawCm_ = *d;
        const float filtered = distanceFilter_.push(*d);
        waterLevelCm_ = std::max(0.0f, settings_.mountHeightCm - filtered);
    } else {
        ++consecutiveReadErrors_;
    }

    rainSinceReportMm_ += static_cast<float>(hw_.rain.takeTipCount()) * hw_.rain.mmPerTip();

    // Siêu âm mất xung ECHO liên tục (đứt dây, đầu dò ngập/bẩn) -> không tin mực nước nữa.
    sensorFault_ = consecutiveReadErrors_ >= kMaxReadErrors;

    const FloodStatus prev = status_ == FloodStatus::SensorFault ? FloodStatus::Safe : status_;
    status_ = sensorFault_ ? FloodStatus::SensorFault
                           : classify(waterLevelCm_, settings_.thresholds, prev);

    hw_.alarm.show(status_, !sirenMuted_);
}

bool FloodStation::shouldReport() const {
    if (!hasReported_) return true;
    if (status_ != lastReportedStatus_) return true;  // báo ngay khi đổi trạng thái
    const uint64_t intervalMs =
        static_cast<uint64_t>(reportIntervalSec(status_, settings_.intervals)) * 1000;
    return hw_.clock.nowMs() - lastReportMs_ >= intervalMs;
}

Telemetry FloodStation::buildTelemetry() {
    Telemetry t;
    t.timestampMs = hw_.clock.nowMs();
    t.waterLevelCm = waterLevelCm_;
    t.distanceRawCm = distanceRawCm_;
    t.rainfallMm = rainSinceReportMm_;
    const uint64_t elapsedMs = t.timestampMs - lastReportMs_;
    if (hasReported_ && elapsedMs > 0) {
        t.rainRateMmH = rainSinceReportMm_ * 3600000.0f / static_cast<float>(elapsedMs);
    }
    t.sensorFault = sensorFault_;
    t.status = status_;
    return t;
}

void FloodStation::markReported() {
    hasReported_ = true;
    lastReportedStatus_ = status_;
    lastReportMs_ = hw_.clock.nowMs();
    rainSinceReportMm_ = 0.0f;
}

}  // namespace flood
