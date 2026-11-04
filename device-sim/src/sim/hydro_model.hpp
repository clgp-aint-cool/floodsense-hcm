#pragma once

#include "sim/station_config.hpp"

namespace sim {

// Mô hình "bể chứa" cho một điểm ngập (đơn vị cm, giờ):
//   dH/dt = kRain·R(t) + kTide·max(0, T(t) − T0) − kDrain·H
// R: mưa mm/h, T: triều m, T0: cao độ cửa xả.
class HydroModel {
public:
    explicit HydroModel(const HydroParams& p) : p_(p), levelCm_(p.initialLevelCm) {}

    void step(double rainMmH, double tideM, double dtHours);
    double levelCm() const { return levelCm_; }

private:
    HydroParams p_;
    double levelCm_;
};

}  // namespace sim
