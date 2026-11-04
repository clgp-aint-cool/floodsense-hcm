#include "sim/sim_hardware.hpp"

#include <algorithm>
#include <chrono>
#include <cmath>

namespace sim {

uint64_t RealClock::nowMs() const {
    using namespace std::chrono;
    return static_cast<uint64_t>(
        duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count());
}

SimDistanceSensor::SimDistanceSensor(const SimWorld& world, double mountHeightCm, unsigned seed)
    : world_(world), mountHeightCm_(mountHeightCm), rng_(seed) {}

std::optional<float> SimDistanceSensor::readDistanceCm() {
    if (world_.distanceSensorFailed) return std::nullopt;
    std::uniform_real_distribution<double> u(0.0, 1.0);
    if (u(rng_) < kTimeoutRate) return std::nullopt;

    const double distance = mountHeightCm_ - world_.hydro.levelCm();
    if (distance < kBlindZoneCm || distance > kMaxRangeCm) return std::nullopt;

    std::normal_distribution<double> noise(0.0, 0.5);
    return static_cast<float>(std::round((distance + noise(rng_)) * 10.0) / 10.0);
}

uint32_t SimRainGauge::takeTipCount() {
    const auto tips = static_cast<uint32_t>(bucketMm_ / mmPerTip());
    bucketMm_ -= tips * mmPerTip();
    return tips;
}

}  // namespace sim
