#pragma once

#include <string>
#include <vector>

namespace sim {

struct HydroParams {
    double kRain = 0.5;          // cm mực nước dâng / mm mưa
    double kDrain = 1.0;         // tỉ lệ thoát nước mỗi giờ (1/h)
    double kTide = 15.0;         // cm/h dâng thêm trên mỗi mét triều vượt ngưỡng
    double tideThresholdM = 1.3; // cao độ cửa xả; triều cao hơn thì nước tràn ngược
    double initialLevelCm = 0.0;
};

struct StationConfig {
    std::string deviceId;    // VN-HCM-001 — cũng là tên device trên ThingsBoard
    std::string deviceName;
    std::string parentId;
    std::string parentName;
    std::string parentType;  // ROAD | ZONE
    std::string district;
    std::string stationNode;
    int segmentIdx = 0;
    double latitude = 0;
    double longitude = 0;
    double mountHeightCm = 200.0;
    HydroParams hydro;
};

std::vector<StationConfig> loadStations(const std::string& path);

}  // namespace sim
