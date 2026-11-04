#include "sim/station_config.hpp"

#include <fstream>
#include <nlohmann/json.hpp>
#include <stdexcept>

namespace sim {

std::vector<StationConfig> loadStations(const std::string& path) {
    std::ifstream in(path);
    if (!in) throw std::runtime_error("Không mở được file cấu hình trạm: " + path);
    const auto doc = nlohmann::json::parse(in);

    std::vector<StationConfig> stations;
    for (const auto& j : doc) {
        StationConfig s;
        s.deviceId = j.at("device_id").get<std::string>();
        s.deviceName = j.value("device_name", s.deviceId);
        s.parentId = j.value("parent_id", "");
        s.parentName = j.value("parent_name", "");
        s.parentType = j.value("parent_type", "ROAD");
        s.district = j.value("district", "");
        s.stationNode = j.value("station_node", "");
        s.segmentIdx = j.value("segment_idx", 0);
        s.latitude = j.at("latitude").get<double>();
        s.longitude = j.at("longitude").get<double>();
        if (j.contains("sensor")) s.mountHeightCm = j["sensor"].value("mount_height_cm", 200.0);
        if (j.contains("hydro")) {
            const auto& h = j["hydro"];
            s.hydro.kRain = h.value("k_rain", s.hydro.kRain);
            s.hydro.kDrain = h.value("k_drain", s.hydro.kDrain);
            s.hydro.kTide = h.value("k_tide", s.hydro.kTide);
            s.hydro.tideThresholdM = h.value("tide_threshold_m", s.hydro.tideThresholdM);
            s.hydro.initialLevelCm = h.value("initial_level_cm", s.hydro.initialLevelCm);
        }
        stations.push_back(std::move(s));
    }
    return stations;
}

}  // namespace sim
