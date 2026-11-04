// Test lõi không cần framework: chạy bằng `ctest`.
#include <cmath>
#include <cstdio>
#include <cstdlib>

#include "flood/classifier.hpp"
#include "flood/flood_station.hpp"
#include "flood/median_filter.hpp"

using namespace flood;

static int failures = 0;
#define CHECK(cond)                                                    \
    do {                                                               \
        if (!(cond)) {                                                 \
            std::fprintf(stderr, "%s:%d CHECK(%s)\n", __FILE__, __LINE__, #cond); \
            ++failures;                                                \
        }                                                              \
    } while (0)

struct FakeClock : IClock {
    uint64_t t = 0;
    uint64_t nowMs() const override { return t; }
};
struct FakeDistance : IDistanceSensor {
    std::optional<float> value = 200.0f;
    std::optional<float> readDistanceCm() override { return value; }
};
struct FakeRain : IRainGauge {
    uint32_t tips = 0;
    uint32_t takeTipCount() override { uint32_t n = tips; tips = 0; return n; }
    float mmPerTip() const override { return 0.2f; }
};
struct FakeAlarm : IAlarmOutput {
    FloodStatus last = FloodStatus::Safe;
    void show(FloodStatus s, bool) override { last = s; }
};

static void testClassifierHysteresis() {
    Thresholds t;
    CHECK(classify(10, t, FloodStatus::Safe) == FloodStatus::Safe);
    CHECK(classify(36, t, FloodStatus::Safe) == FloodStatus::Warning);
    CHECK(classify(55, t, FloodStatus::Warning) == FloodStatus::Critical);
    CHECK(classify(49, t, FloodStatus::Critical) == FloodStatus::Critical);  // trong vùng trễ
    CHECK(classify(47, t, FloodStatus::Critical) == FloodStatus::Warning);
}

static void testMedianFilterRejectsSpike() {
    MedianFilter<5> f;
    f.push(100); f.push(101); f.push(100); f.push(102);
    CHECK(std::fabs(f.push(5) - 100.0f) < 1.5f);
}

static void testStationFlow() {
    FakeClock clock; FakeDistance dist; FakeRain rain; FakeAlarm alarm;
    FloodStation st({clock, dist, rain, alarm}, StationSettings{});

    st.sample();
    CHECK(st.status() == FloodStatus::Safe);
    CHECK(st.shouldReport());  // lần đầu luôn gửi
    st.markReported();
    clock.t = 1000;
    CHECK(!st.shouldReport());

    // Nước dâng 60 cm -> CRITICAL, gửi ngay vì đổi trạng thái
    dist.value = 140.0f;
    rain.tips = 10;
    for (int i = 0; i < 5; ++i) st.sample();
    CHECK(st.status() == FloodStatus::Critical);
    CHECK(alarm.last == FloodStatus::Critical);
    CHECK(st.shouldReport());
    Telemetry t = st.buildTelemetry();
    CHECK(std::fabs(t.waterLevelCm - 60.0f) < 0.01f);
    CHECK(std::fabs(t.rainfallMm - 2.0f) < 0.01f);
    CHECK(std::fabs(t.rainRateMmH - 7200.0f) < 0.5f);  // 2 mm trong 1 s = 7200 mm/h

    // Mất tín hiệu siêu âm 4 lần chưa đủ, lần thứ 5 liên tiếp -> SENSOR_FAULT
    dist.value.reset();
    for (int i = 0; i < 4; ++i) st.sample();
    CHECK(st.status() == FloodStatus::Critical);
    st.sample();
    CHECK(st.status() == FloodStatus::SensorFault);
    CHECK(st.buildTelemetry().sensorFault);

    // Siêu âm đọc lại được -> hết lỗi
    dist.value = 140.0f;
    st.sample();
    CHECK(st.status() != FloodStatus::SensorFault);
}

int main() {
    testClassifierHysteresis();
    testMedianFilterRejectsSpike();
    testStationFlow();
    if (failures) {
        std::fprintf(stderr, "%d check(s) failed\n", failures);
        return EXIT_FAILURE;
    }
    std::puts("core tests passed");
    return EXIT_SUCCESS;
}
