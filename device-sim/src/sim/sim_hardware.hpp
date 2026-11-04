#pragma once

#include <random>

#include "flood/interfaces.hpp"
#include "sim/hydro_model.hpp"

// Cài đặt HAL của core/ bằng mô hình giả lập. Mỗi lớp mô phỏng đặc tính của
// linh kiện thật theo datasheet (nhiễu, vùng mù, độ phân giải gáo lật...).
namespace sim {

// Trạng thái môi trường tại một trạm, do TbDevice cập nhật mỗi tick.
struct SimWorld {
    explicit SimWorld(const HydroParams& p) : hydro(p) {}
    HydroModel hydro;
    double rainMmH = 0;
    double tideM = 0;
    bool distanceSensorFailed = false;  // tiêm lỗi
};

class RealClock : public flood::IClock {
public:
    uint64_t nowMs() const override;
};

// JSN-SR04T: tầm 25–450 cm, sai số ~±1 cm, vùng mù ~25 cm, thỉnh thoảng timeout.
class SimDistanceSensor : public flood::IDistanceSensor {
public:
    SimDistanceSensor(const SimWorld& world, double mountHeightCm, unsigned seed);
    std::optional<float> readDistanceCm() override;

    static constexpr double kBlindZoneCm = 25.0;
    static constexpr double kMaxRangeCm = 450.0;
    static constexpr double kTimeoutRate = 0.01;

private:
    const SimWorld& world_;
    double mountHeightCm_;
    std::mt19937 rng_;
};

// Gáo lật 0.2 mm/lần: lượng mưa được lượng tử hóa thành số xung.
class SimRainGauge : public flood::IRainGauge {
public:
    explicit SimRainGauge(const SimWorld& world) : world_(world) {}
    void advance(double dtHours) { bucketMm_ += world_.rainMmH * dtHours; }
    uint32_t takeTipCount() override;
    float mmPerTip() const override { return 0.2f; }

private:
    const SimWorld& world_;
    double bucketMm_ = 0;
};

class SilentAlarm : public flood::IAlarmOutput {
public:
    void show(flood::FloodStatus status, bool) override { last_ = status; }
    flood::FloodStatus last() const { return last_; }

private:
    flood::FloodStatus last_ = flood::FloodStatus::Safe;
};

}  // namespace sim
