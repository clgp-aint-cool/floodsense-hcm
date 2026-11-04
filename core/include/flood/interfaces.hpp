#pragma once

#include <cstdint>
#include <optional>

#include "flood/types.hpp"

// Lớp trừu tượng phần cứng (HAL). firmware/ cài đặt bằng driver thật,
// device-sim/ cài đặt bằng mô hình giả lập.
namespace flood {

class IClock {
public:
    virtual ~IClock() = default;
    virtual uint64_t nowMs() const = 0;
};

class IDistanceSensor {  // JSN-SR04T: khoảng cách từ cảm biến tới mặt nước
public:
    virtual ~IDistanceSensor() = default;
    virtual std::optional<float> readDistanceCm() = 0;  // nullopt = timeout/lỗi đọc
};

class IRainGauge {  // gáo lật: đếm số lần lật kể từ lần đọc trước
public:
    virtual ~IRainGauge() = default;
    virtual uint32_t takeTipCount() = 0;
    virtual float mmPerTip() const = 0;
};

class IAlarmOutput {  // đèn 3 màu + còi
public:
    virtual ~IAlarmOutput() = default;
    virtual void show(FloodStatus status, bool sirenEnabled) = 0;
};

}  // namespace flood
