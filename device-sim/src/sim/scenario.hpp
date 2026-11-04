#pragma once

#include <string>
#include <vector>

namespace sim {

struct ScenarioPoint {
    double minute = 0;     // phút kể từ đầu kịch bản
    double rainMmH = 0;    // cường độ mưa (mm/h)
    double tideM = 0;      // mực triều (m)
};

// Kịch bản môi trường đọc từ CSV `minute,rain_mm_h,tide_m`, nội suy tuyến tính.
// Sinh CSV từ dữ liệu thật bằng tools/make_scenario.py (Open-Meteo + mô hình triều).
class Scenario {
public:
    static Scenario fromCsv(const std::string& path);
    static Scenario constant(double rainMmH, double tideM);

    ScenarioPoint at(double minute) const;
    double durationMin() const { return points_.empty() ? 0 : points_.back().minute; }
    const std::string& name() const { return name_; }

private:
    std::string name_;
    std::vector<ScenarioPoint> points_;
};

}  // namespace sim
