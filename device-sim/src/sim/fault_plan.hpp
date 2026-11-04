#pragma once

#include <string>
#include <vector>

namespace sim {

enum class FaultType { Sensor, Network };

// Lỗi tiêm theo kịch bản, cú pháp CLI: DEVICE_ID:sensor|network:START_MIN[:DURATION_MIN]
// VD: --fault VN-HCM-003:network:2:5  -> trạm 003 mất mạng từ phút 2 trong 5 phút (theo thời gian kịch bản).
struct Fault {
    std::string deviceId;
    FaultType type = FaultType::Sensor;
    double startMin = 0;
    double durationMin = 0;  // 0 = mãi mãi

    bool activeAt(double minute) const {
        return minute >= startMin && (durationMin <= 0 || minute < startMin + durationMin);
    }
};

Fault parseFault(const std::string& spec);

}  // namespace sim
