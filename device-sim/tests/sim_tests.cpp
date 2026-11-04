// Test giả lập không cần MQTT: chạy bằng `ctest` trong thư mục build.
#include <cmath>
#include <cstdio>
#include <cstdlib>

#include "device/tb_device.hpp"
#include "sim/fault_plan.hpp"
#include "sim/hydro_model.hpp"
#include "sim/scenario.hpp"
#include "sim/station_config.hpp"

static int failures = 0;
#define CHECK(cond)                                                                   \
    do {                                                                              \
        if (!(cond)) {                                                                \
            std::fprintf(stderr, "%s:%d CHECK(%s)\n", __FILE__, __LINE__, #cond);    \
            ++failures;                                                               \
        }                                                                             \
    } while (0)

static void testHydroEquilibrium() {
    sim::HydroParams p;
    p.kRain = 0.8;
    p.kDrain = 0.64;
    sim::HydroModel m(p);
    m.step(40.0, 0.0, 24.0);  // mưa 40 mm/h kéo dài -> cân bằng kRain·R/kDrain = 50 cm
    CHECK(std::fabs(m.levelCm() - 50.0) < 0.5);
    m.step(0.0, 0.0, 24.0);   // tạnh mưa -> rút hết
    CHECK(m.levelCm() < 0.5);
}

static void testScenarioInterpolation() {
    auto s = sim::Scenario::fromCsv("scenarios/heavy_rain.csv");
    CHECK(s.durationMin() > 0);
    auto a = s.at(0), b = s.at(s.durationMin() / 2);
    CHECK(b.rainMmH >= 0);
    CHECK(a.minute == 0);
}

static void testStationsConfig() {
    auto stations = sim::loadStations("config/stations.json");
    CHECK(stations.size() == 50);
    CHECK(stations[0].deviceId == "VN-HCM-001");
}

static void testFaultParse() {
    auto f = sim::parseFault("VN-HCM-003:network:2:5");
    CHECK(f.type == sim::FaultType::Network);
    CHECK(f.activeAt(3) && !f.activeAt(8));
}

static void testDeviceRisesToCriticalUnderStorm() {
    auto stations = sim::loadStations("config/stations.json");
    auto storm = sim::Scenario::constant(60.0, 1.6);
    device::DeviceOptions opts;
    opts.speed = 600;  // 10 phút kịch bản mỗi giây
    device::TbDevice d(stations[2], opts, nullptr, storm, {});  // trạm 003: rốn ngập
    bool sawPayload = false;
    for (int i = 0; i < 60; ++i) {
        d.advanceTick(1.0);
        if (auto p = d.pollTelemetry()) {
            sawPayload = true;
            CHECK(p->at("values").contains("water_level_cm"));
        }
    }
    CHECK(sawPayload);
    CHECK(d.status() == flood::FloodStatus::Critical);
}

int main() {
    testHydroEquilibrium();
    testScenarioInterpolation();
    testStationsConfig();
    testFaultParse();
    testDeviceRisesToCriticalUnderStorm();
    if (failures) {
        std::fprintf(stderr, "%d check(s) failed\n", failures);
        return EXIT_FAILURE;
    }
    std::puts("sim tests passed");
    return EXIT_SUCCESS;
}
