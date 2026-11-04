#include "sim/fault_plan.hpp"

#include <sstream>
#include <stdexcept>

namespace sim {

Fault parseFault(const std::string& spec) {
    std::vector<std::string> parts;
    std::stringstream ss(spec);
    for (std::string p; std::getline(ss, p, ':');) parts.push_back(p);
    if (parts.size() < 3) throw std::invalid_argument("Sai cú pháp --fault: " + spec);

    Fault f;
    f.deviceId = parts[0];
    if (parts[1] == "sensor") f.type = FaultType::Sensor;
    else if (parts[1] == "network") f.type = FaultType::Network;
    else throw std::invalid_argument("Loại lỗi không hợp lệ: " + parts[1]);
    f.startMin = std::stod(parts[2]);
    if (parts.size() > 3) f.durationMin = std::stod(parts[3]);
    return f;
}

}  // namespace sim
