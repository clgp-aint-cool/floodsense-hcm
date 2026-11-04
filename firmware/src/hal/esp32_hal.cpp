#include "esp32_hal.h"

// TODO(firmware): cài đặt từng driver. Giữ nguyên chữ ký hàm để FloodStation dùng được.

uint64_t ArduinoClock::nowMs() const { return millis(); }

JsnSr04tSensor::JsnSr04tSensor(uint8_t, uint8_t) {}
void JsnSr04tSensor::begin() {}
std::optional<float> JsnSr04tSensor::readDistanceCm() { return std::nullopt; }

TippingBucketGauge::TippingBucketGauge(uint8_t) {}
void TippingBucketGauge::begin() {}
uint32_t TippingBucketGauge::takeTipCount() { return 0; }

LedBuzzerAlarm::LedBuzzerAlarm(uint8_t, uint8_t, uint8_t, uint8_t) {}
void LedBuzzerAlarm::begin() {}
void LedBuzzerAlarm::show(flood::FloodStatus, bool) {}
