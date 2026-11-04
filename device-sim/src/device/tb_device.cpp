#include "device/tb_device.hpp"

#include <chrono>
#include <condition_variable>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <random>
#include <thread>

#include "device/telemetry_json.hpp"

namespace device {

namespace {

constexpr const char* kTelemetryTopic = "v1/devices/me/telemetry";
constexpr const char* kAttributesTopic = "v1/devices/me/attributes";
constexpr const char* kRpcRequestPrefix = "v1/devices/me/rpc/request/";
constexpr const char* kRpcResponsePrefix = "v1/devices/me/rpc/response/";

std::mutex gLogMutex;

std::string randomToken() {
    std::random_device rd;
    std::uniform_int_distribution<int> hex(0, 15);
    std::string t;
    for (int i = 0; i < 20; ++i) t += "0123456789abcdef"[hex(rd)];
    return t;
}

flood::StationSettings settingsFor(const sim::StationConfig& c) {
    flood::StationSettings s;
    s.mountHeightCm = static_cast<float>(c.mountHeightCm);
    return s;
}

}  // namespace

TbDevice::TbDevice(sim::StationConfig station, DeviceOptions options,
                   mqtt_io::TransportFactory factory, const sim::Scenario& scenario,
                   std::vector<sim::Fault> faults)
    : config_(std::move(station)),
      options_(std::move(options)),
      factory_(std::move(factory)),
      scenario_(scenario),
      faults_(std::move(faults)),
      world_(config_.hydro),
      distance_(world_, config_.mountHeightCm, static_cast<unsigned>(std::hash<std::string>{}(config_.deviceId))),
      rain_(world_),
      station_({clock_, distance_, rain_, alarm_}, settingsFor(config_)) {}

void TbDevice::log(const std::string& msg) const {
    std::lock_guard<std::mutex> lock(gLogMutex);
    std::cout << '[' << config_.deviceId << "] " << msg << std::endl;
}

bool TbDevice::faultActive(sim::FaultType type) const {
    for (const auto& f : faults_) {
        if (f.type == type && f.activeAt(scenarioMinute_)) return true;
    }
    return false;
}

void TbDevice::advanceTick(double realDtSec) {
    const double simDtMin = realDtSec * options_.speed / 60.0;
    scenarioMinute_ += simDtMin;
    if (options_.loopScenario && scenario_.durationMin() > 0 && scenarioMinute_ > scenario_.durationMin()) {
        scenarioMinute_ = 0;
    }

    const auto env = scenario_.at(scenarioMinute_);
    std::lock_guard<std::mutex> lock(stationMutex_);
    world_.rainMmH = env.rainMmH;
    world_.tideM = env.tideM;
    world_.distanceSensorFailed = faultActive(sim::FaultType::Sensor);

    world_.hydro.step(env.rainMmH, env.tideM, simDtMin / 60.0);  // mực nước chạy theo thời gian kịch bản
    rain_.advance(realDtSec / 3600.0);  // gáo lật đo cường độ hiện tại theo thời gian thật
    station_.sample();
}

std::optional<nlohmann::json> TbDevice::pollTelemetry() {
    std::lock_guard<std::mutex> lock(stationMutex_);
    if (!station_.shouldReport()) return std::nullopt;
    const auto t = station_.buildTelemetry();
    station_.markReported();
    if (t.status != lastLoggedStatus_) {
        log(std::string("trạng thái ") + flood::toString(lastLoggedStatus_) + " -> " +
            flood::toString(t.status) + " (" + std::to_string(t.waterLevelCm) + " cm)");
        lastLoggedStatus_ = t.status;
    }
    return telemetryPayload(config_, t);
}

std::optional<std::string> TbDevice::obtainAccessToken() {
    namespace fs = std::filesystem;
    const fs::path tokenFile = fs::path(options_.stateDir) / (config_.deviceId + ".token");
    if (std::ifstream in(tokenFile); in) {
        std::string token;
        if (std::getline(in, token) && !token.empty()) return token;
    }
    auto token = provision();
    if (token) {
        fs::create_directories(options_.stateDir);
        std::ofstream(tokenFile) << *token << '\n';
    }
    return token;
}

// Device provisioning qua MQTT: https://thingsboard.io/docs/user-guide/device-provisioning/
std::optional<std::string> TbDevice::provision() {
    if (options_.provisionKey.empty()) {
        log("thiếu TB_PROVISION_KEY/SECRET — dùng device_id làm access token (tạo device thủ công trên TB)");
        return config_.deviceId;
    }
    auto transport = factory_();
    std::mutex m;
    std::condition_variable cv;
    std::optional<std::string> result;
    bool done = false;

    const std::string requested = randomToken();
    transport->setMessageHandler([&](const std::string& topic, const std::string& payload) {
        if (topic != "/provision/response") return;
        std::lock_guard<std::mutex> lock(m);
        const auto j = nlohmann::json::parse(payload, nullptr, false);
        if (!j.is_discarded() && j.value("status", "") == "SUCCESS") {
            result = j.value("credentialsValue", requested);
        } else {
            log("provision bị từ chối: " + payload);
        }
        done = true;
        cv.notify_all();
    });

    if (!transport->connect({options_.host, options_.port, config_.deviceId + "-provision", "provision"})) {
        return std::nullopt;
    }
    transport->subscribe("/provision/response", 1);
    const nlohmann::json request = {{"deviceName", config_.deviceId},
                                    {"provisionDeviceKey", options_.provisionKey},
                                    {"provisionDeviceSecret", options_.provisionSecret},
                                    {"credentialsType", "ACCESS_TOKEN"},
                                    {"token", requested}};
    transport->publish("/provision/request", request.dump(), 1);

    std::unique_lock<std::mutex> lock(m);
    cv.wait_for(lock, std::chrono::seconds(15), [&] { return done; });
    transport->disconnect();
    return result;
}

bool TbDevice::connectAndSubscribe(mqtt_io::ITransport& transport, const std::string& token) {
    transport.setMessageHandler([this, &transport](const std::string& topic, const std::string& payload) {
        onMessage(transport, topic, payload);
    });
    if (!transport.connect({options_.host, options_.port, config_.deviceId, token})) return false;
    return transport.subscribe(std::string(kRpcRequestPrefix) + "+", 1) &&
           transport.subscribe(kAttributesTopic, 1) &&
           transport.publish(kAttributesTopic, clientAttributes(config_).dump(), 1);
}

void TbDevice::onMessage(mqtt_io::ITransport& transport, const std::string& topic,
                         const std::string& payload) {
    const auto body = nlohmann::json::parse(payload, nullptr, false);
    if (body.is_discarded()) return;

    if (topic.rfind(kRpcRequestPrefix, 0) == 0) {
        const std::string requestId = topic.substr(std::string(kRpcRequestPrefix).size());
        const auto response = handleRpc(body.value("method", ""), body.value("params", nlohmann::json{}));
        transport.publish(kRpcResponsePrefix + requestId, response.dump(), 1);
    } else if (topic == kAttributesTopic) {
        applySharedAttributes(body.contains("shared") ? body["shared"] : body);
    }
}

// RPC từ dashboard/backend. Firmware ESP32 cài đặt cùng tập lệnh này.
nlohmann::json TbDevice::handleRpc(const std::string& method, const nlohmann::json& params) {
    std::lock_guard<std::mutex> lock(stationMutex_);
    if (method == "getStatus") {
        return {{"status", flood::toString(station_.status())},
                {"water_level_cm", world_.hydro.levelCm()},
                {"scenario_minute", scenarioMinute_}};
    }
    if (method == "muteSiren") {
        station_.setSirenMuted(params.is_boolean() ? params.get<bool>() : true);
        return {{"ok", true}};
    }
    if (method == "testSiren") {
        log("RPC testSiren: bật còi thử 3 giây");
        return {{"ok", true}};
    }
    // TODO: setInterval, reboot
    return {{"error", "unknown method " + method}};
}

// Shared attributes: alert_cm, warning_cm, critical_cm.
void TbDevice::applySharedAttributes(const nlohmann::json& attrs) {
    std::lock_guard<std::mutex> lock(stationMutex_);
    auto t = station_.settings().thresholds;
    t.alertCm = attrs.value("alert_cm", t.alertCm);
    t.warningCm = attrs.value("warning_cm", t.warningCm);
    t.criticalCm = attrs.value("critical_cm", t.criticalCm);
    station_.setThresholds(t);
    log("cập nhật ngưỡng: " + attrs.dump());
}

void TbDevice::run(const std::atomic<bool>& stop) {
    using namespace std::chrono;
    const auto tick = milliseconds(options_.tickMs);
    int backoffSec = 1;

    std::optional<std::string> token;
    std::unique_ptr<mqtt_io::ITransport> transport;

    while (!stop) {
        if (!token) {
            token = obtainAccessToken();
            if (!token) {
                log("không lấy được access token, thử lại sau " + std::to_string(backoffSec) + " s");
                std::this_thread::sleep_for(seconds(backoffSec));
                backoffSec = std::min(backoffSec * 2, 60);
                continue;
            }
        }

        const bool networkDown = faultActive(sim::FaultType::Network);
        if (!networkDown && (!transport || !transport->isConnected())) {
            transport = factory_();
            if (connectAndSubscribe(*transport, *token)) {
                log("đã kết nối MQTT " + options_.host + ":" + std::to_string(options_.port));
                backoffSec = 1;
            } else {
                log("kết nối MQTT thất bại, thử lại sau " + std::to_string(backoffSec) + " s");
                transport.reset();
                std::this_thread::sleep_for(seconds(backoffSec));
                backoffSec = std::min(backoffSec * 2, 60);
                continue;
            }
        } else if (networkDown && transport) {
            log("tiêm lỗi: mất mạng");
            transport->disconnect();
            transport.reset();
        }

        const auto started = steady_clock::now();
        advanceTick(tick.count() / 1000.0);
        if (transport) {
            if (auto payload = pollTelemetry()) {
                if (!transport->publish(kTelemetryTopic, payload->dump(), 1)) {
                    log("publish thất bại (chưa có PUBACK), kết nối lại");
                    transport.reset();
                }
            }
        }
        std::this_thread::sleep_until(started + tick);
    }
    if (transport) transport->disconnect();
}

}  // namespace device
