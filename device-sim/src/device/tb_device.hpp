#pragma once

#include <atomic>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "flood/flood_station.hpp"
#include "mqtt/transport.hpp"
#include "sim/fault_plan.hpp"
#include "sim/scenario.hpp"
#include "sim/sim_hardware.hpp"
#include "sim/station_config.hpp"

namespace device {

struct DeviceOptions {
    std::string host = "localhost";
    int port = 1883;
    std::string provisionKey;
    std::string provisionSecret;
    std::string stateDir = ".sim-state";  // lưu access token để chạy lại không phải provision
    double speed = 1.0;                   // tua nhanh kịch bản: 60 = 1 giờ kịch bản / 1 phút thật
    bool loopScenario = true;
    int tickMs = 1000;
};

// Một trạm ThingsBoard giả lập: BOOT → PROVISION → CONNECT → ONLINE ⇄ RECONNECT.
class TbDevice {
public:
    TbDevice(sim::StationConfig station, DeviceOptions options, mqtt_io::TransportFactory factory,
             const sim::Scenario& scenario, std::vector<sim::Fault> faults);

    void run(const std::atomic<bool>& stop);

    // Dùng cho test / chế độ offline: tiến mô phỏng một tick mà không cần MQTT.
    void advanceTick(double realDtSec);
    std::optional<nlohmann::json> pollTelemetry();
    flood::FloodStatus status() const { return station_.status(); }
    double scenarioMinute() const { return scenarioMinute_; }

private:
    std::optional<std::string> obtainAccessToken();
    std::optional<std::string> provision();
    bool connectAndSubscribe(mqtt_io::ITransport& transport, const std::string& token);
    void onMessage(mqtt_io::ITransport& transport, const std::string& topic, const std::string& payload);
    nlohmann::json handleRpc(const std::string& method, const nlohmann::json& params);
    void applySharedAttributes(const nlohmann::json& attrs);
    bool faultActive(sim::FaultType type) const;
    void log(const std::string& msg) const;

    sim::StationConfig config_;
    DeviceOptions options_;
    mqtt_io::TransportFactory factory_;
    const sim::Scenario& scenario_;
    std::vector<sim::Fault> faults_;

    sim::SimWorld world_;
    sim::RealClock clock_;
    sim::SimDistanceSensor distance_;
    sim::SimRainGauge rain_;
    sim::SilentAlarm alarm_;
    flood::FloodStation station_;

    std::mutex stationMutex_;  // callback MQTT chạy trên thread khác
    double scenarioMinute_ = 0;
    flood::FloodStatus lastLoggedStatus_ = flood::FloodStatus::Safe;
};

}  // namespace device
