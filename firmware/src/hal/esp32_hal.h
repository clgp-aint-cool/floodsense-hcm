#pragma once
// Cài đặt HAL của core/ bằng driver thật trên ESP32. Chỉ là skeleton: các hàm TODO.
#include <Arduino.h>

#include "flood/interfaces.hpp"

class ArduinoClock : public flood::IClock {
public:
    uint64_t nowMs() const override;  // TODO: epoch ms qua NTP (configTime) để TB nhận đúng ts
};

class JsnSr04tSensor : public flood::IDistanceSensor {
public:
    JsnSr04tSensor(uint8_t trig, uint8_t echo);
    void begin();
    std::optional<float> readDistanceCm() override;  // TODO: pulseIn, timeout 30 ms, đổi µs -> cm
};

class TippingBucketGauge : public flood::IRainGauge {
public:
    explicit TippingBucketGauge(uint8_t pin);
    void begin();                  // TODO: attachInterrupt FALLING
    uint32_t takeTipCount() override;  // TODO: đọc & reset biến đếm volatile trong critical section
    float mmPerTip() const override { return 0.2f; }
};

class LedBuzzerAlarm : public flood::IAlarmOutput {
public:
    LedBuzzerAlarm(uint8_t green, uint8_t yellow, uint8_t red, uint8_t buzzer);
    void begin();
    void show(flood::FloodStatus status, bool sirenEnabled) override;  // TODO: đèn theo mức, còi nhịp khi CRITICAL
};
