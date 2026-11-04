#pragma once

#include "flood/interfaces.hpp"
#include "flood/median_filter.hpp"
#include "flood/types.hpp"

namespace flood {

struct StationHardware {
    IClock& clock;
    IDistanceSensor& distance;
    IRainGauge& rain;
    IAlarmOutput& alarm;
};

// Logic một trạm quan trắc, độc lập phần cứng và giao thức.
// Vòng lặp: gọi sample() thường xuyên (vd. 1 lần/giây), khi shouldReport() == true
// thì lấy buildTelemetry() gửi đi rồi gọi markReported().
class FloodStation {
public:
    FloodStation(StationHardware hw, StationSettings settings);

    void sample();
    bool shouldReport() const;
    Telemetry buildTelemetry();
    void markReported();

    // Điều khiển từ xa (shared attributes / RPC)
    void setThresholds(const Thresholds& t) { settings_.thresholds = t; }
    void setIntervals(const ReportIntervals& i) { settings_.intervals = i; }
    void setSirenMuted(bool muted) { sirenMuted_ = muted; }

    FloodStatus status() const { return status_; }
    const StationSettings& settings() const { return settings_; }

private:
    StationHardware hw_;
    StationSettings settings_;
    MedianFilter<5> distanceFilter_;

    FloodStatus status_ = FloodStatus::Safe;
    FloodStatus lastReportedStatus_ = FloodStatus::Safe;
    float waterLevelCm_ = 0.0f;
    float distanceRawCm_ = 0.0f;
    float rainSinceReportMm_ = 0.0f;
    bool sensorFault_ = false;
    int consecutiveReadErrors_ = 0;
    bool sirenMuted_ = false;
    bool hasReported_ = false;
    uint64_t lastReportMs_ = 0;
};

}  // namespace flood
