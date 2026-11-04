#include "sim/scenario.hpp"

#include <algorithm>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace sim {

Scenario Scenario::fromCsv(const std::string& path) {
    std::ifstream in(path);
    if (!in) throw std::runtime_error("Không mở được kịch bản: " + path);

    Scenario s;
    s.name_ = path.substr(path.find_last_of("/\\") + 1);
    std::string line;
    while (std::getline(in, line)) {
        if (line.empty() || line[0] == '#' || line.rfind("minute", 0) == 0) continue;
        std::replace(line.begin(), line.end(), ',', ' ');
        std::istringstream row(line);
        ScenarioPoint p;
        if (row >> p.minute >> p.rainMmH >> p.tideM) s.points_.push_back(p);
    }
    if (s.points_.empty()) throw std::runtime_error("Kịch bản rỗng: " + path);
    std::sort(s.points_.begin(), s.points_.end(),
              [](const auto& a, const auto& b) { return a.minute < b.minute; });
    return s;
}

Scenario Scenario::constant(double rainMmH, double tideM) {
    Scenario s;
    s.name_ = "constant";
    s.points_.push_back({0, rainMmH, tideM});
    return s;
}

ScenarioPoint Scenario::at(double minute) const {
    if (minute <= points_.front().minute) return points_.front();
    if (minute >= points_.back().minute) return points_.back();
    auto hi = std::upper_bound(points_.begin(), points_.end(), minute,
                               [](double m, const ScenarioPoint& p) { return m < p.minute; });
    auto lo = hi - 1;
    const double r = (minute - lo->minute) / (hi->minute - lo->minute);
    return {minute, lo->rainMmH + r * (hi->rainMmH - lo->rainMmH),
            lo->tideM + r * (hi->tideM - lo->tideM)};
}

}  // namespace sim
