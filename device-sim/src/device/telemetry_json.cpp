#include "device/telemetry_json.hpp"

#include <cmath>

namespace device {

namespace {
double round1(double v) { return std::round(v * 10.0) / 10.0; }
}  // namespace

nlohmann::json telemetryPayload(const sim::StationConfig& s, const flood::Telemetry& t) {
    const bool isRoad = s.parentType == "ROAD";
    nlohmann::json values = {
        {"device_id", s.deviceId},
        {"source", "simulator"},
        {"device_name", s.deviceName},
        {"parent_id", s.parentId},
        {"parent_name", s.parentName},
        {"parent_type", s.parentType},
        {"road_id", isRoad ? nlohmann::json(s.parentId) : nlohmann::json(nullptr)},
        {"road_name", isRoad ? nlohmann::json(s.parentName) : nlohmann::json(nullptr)},
        {"station_node", s.stationNode},
        {"segment_idx", s.segmentIdx},
        {"district", s.district},
        {"latitude", s.latitude},
        {"longitude", s.longitude},
        {"water_level_cm", round1(t.waterLevelCm)},
        {"distance_raw_cm", round1(t.distanceRawCm)},
        {"rainfall_mm", round1(t.rainRateMmH)},  // cường độ mưa mm/h (giữ tên key cũ)
        {"rain_since_last_mm", round1(t.rainfallMm)},
        {"sensor_fault", t.sensorFault},
        {"status", flood::toString(t.status)},
    };
    return {{"ts", t.timestampMs}, {"values", values}};
}

nlohmann::json clientAttributes(const sim::StationConfig& s) {
    return {
        {"firmware", "flood-sim/0.1.0"},
        {"mount_height_cm", s.mountHeightCm},
        {"latitude", s.latitude},
        {"longitude", s.longitude},
        {"district", s.district},
        {"station_node", s.stationNode},
    };
}

}  // namespace device
