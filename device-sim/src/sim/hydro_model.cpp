#include "sim/hydro_model.hpp"

#include <algorithm>

namespace sim {

void HydroModel::step(double rainMmH, double tideM, double dtHours) {
    // Chia nhỏ bước tích phân Euler để ổn định khi chạy tua nhanh.
    constexpr double kMaxSubStepH = 1.0 / 120.0;  // 30 giây
    while (dtHours > 0) {
        const double h = std::min(dtHours, kMaxSubStepH);
        const double inflow = p_.kRain * rainMmH + p_.kTide * std::max(0.0, tideM - p_.tideThresholdM);
        const double outflow = p_.kDrain * levelCm_;
        levelCm_ = std::max(0.0, levelCm_ + (inflow - outflow) * h);
        dtHours -= h;
    }
}

}  // namespace sim
