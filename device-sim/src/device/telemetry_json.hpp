#pragma once

#include <nlohmann/json.hpp>

#include "flood/types.hpp"
#include "sim/station_config.hpp"

namespace device {

// Payload telemetry giữ nguyên các key backend đang đọc (device_id, water_level_cm,
// rainfall_mm, latitude, longitude, parent_id, segment_idx...).
nlohmann::json telemetryPayload(const sim::StationConfig& station, const flood::Telemetry& t);

// Client attributes gửi một lần khi kết nối (thông tin lắp đặt).
nlohmann::json clientAttributes(const sim::StationConfig& station);

}  // namespace device
