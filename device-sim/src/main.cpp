// flood-sim: giả lập fleet trạm quan trắc ngập gửi telemetry MQTT lên ThingsBoard.
#include <atomic>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "device/tb_device.hpp"
#include "sim/fault_plan.hpp"
#include "sim/scenario.hpp"
#include "sim/station_config.hpp"

namespace {

std::atomic<bool> gStop{false};

void onSignal(int) { gStop = true; }

const char* envOr(const char* name, const char* fallback) {
    const char* v = std::getenv(name);
    return v && *v ? v : fallback;
}

void usage() {
    std::cout <<
        "Usage: flood-sim [options]\n"
        "  --config PATH        file trạm (mặc định config/stations.json)\n"
        "  --scenario PATH      kịch bản CSV minute,rain_mm_h,tide_m (mặc định scenarios/heavy_rain.csv)\n"
        "  --count N            số trạm chạy (mặc định tất cả)\n"
        "  --only ID[,ID...]    chỉ chạy các trạm này\n"
        "  --host HOST          MQTT host (mặc định localhost hoặc $TB_MQTT_HOST)\n"
        "  --port PORT          MQTT port (mặc định 1883)\n"
        "  --speed X            tua nhanh kịch bản, 60 = 1 giờ/1 phút (mặc định 60)\n"
        "  --fault SPEC         DEVICE:sensor|network:START_MIN[:DURATION_MIN], lặp được\n"
        "  --state-dir DIR      nơi lưu access token (mặc định .sim-state)\n"
        "  --dry-run            không kết nối MQTT, in payload ra màn hình\n"
        "  --quiet              dry-run nhưng không in payload\n"
        "Env: TB_PROVISION_KEY, TB_PROVISION_SECRET, TB_MQTT_HOST\n";
}

}  // namespace

int main(int argc, char** argv) {
    std::string configPath = "config/stations.json";
    std::string scenarioPath = "scenarios/heavy_rain.csv";
    std::size_t count = 0;
    std::vector<std::string> only;
    std::vector<sim::Fault> faults;
    bool dryRun = false, verbose = true;

    device::DeviceOptions opts;
    opts.host = envOr("TB_MQTT_HOST", "localhost");
    opts.provisionKey = envOr("TB_PROVISION_KEY", "");
    opts.provisionSecret = envOr("TB_PROVISION_SECRET", "");
    opts.speed = 60.0;

    try {
        for (int i = 1; i < argc; ++i) {
            const std::string a = argv[i];
            auto next = [&]() -> std::string {
                if (i + 1 >= argc) throw std::invalid_argument("thiếu giá trị cho " + a);
                return argv[++i];
            };
            if (a == "--config") configPath = next();
            else if (a == "--scenario") scenarioPath = next();
            else if (a == "--count") count = std::stoul(next());
            else if (a == "--only") {
                std::string list = next();
                for (std::size_t pos = 0; pos != std::string::npos;) {
                    const auto comma = list.find(',', pos);
                    only.push_back(list.substr(pos, comma - pos));
                    pos = comma == std::string::npos ? comma : comma + 1;
                }
            }
            else if (a == "--host") opts.host = next();
            else if (a == "--port") opts.port = std::stoi(next());
            else if (a == "--speed") opts.speed = std::stod(next());
            else if (a == "--fault") faults.push_back(sim::parseFault(next()));
            else if (a == "--state-dir") opts.stateDir = next();
            else if (a == "--dry-run") dryRun = true;
            else if (a == "--quiet") { dryRun = true; verbose = false; }
            else if (a == "-h" || a == "--help") { usage(); return 0; }
            else throw std::invalid_argument("tham số không hợp lệ: " + a);
        }
    } catch (const std::exception& e) {
        std::cerr << e.what() << "\n\n";
        usage();
        return 2;
    }

    std::vector<sim::StationConfig> stations;
    sim::Scenario scenario;
    try {
        stations = sim::loadStations(configPath);
        scenario = sim::Scenario::fromCsv(scenarioPath);
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }

    if (!only.empty()) {
        std::vector<sim::StationConfig> filtered;
        for (auto& s : stations)
            for (const auto& id : only)
                if (s.deviceId == id) filtered.push_back(s);
        stations = std::move(filtered);
    }
    if (count > 0 && count < stations.size()) stations.resize(count);

    mqtt_io::TransportFactory factory;
    if (dryRun) {
        factory = [verbose] { return mqtt_io::makeDryRunTransport(verbose); };
    } else {
#ifdef FLOOD_SIM_WITH_MQTT
        factory = [] { return mqtt_io::makePahoTransport(); };
#else
        std::cerr << "Bản build không có MQTT (FLOOD_SIM_WITH_MQTT=OFF). Dùng --dry-run.\n";
        return 1;
#endif
    }

    std::signal(SIGINT, onSignal);
    std::signal(SIGTERM, onSignal);

    std::cout << "flood-sim: " << stations.size() << " trạm, kịch bản " << scenario.name()
              << " (" << scenario.durationMin() << " phút, x" << opts.speed << "), "
              << (dryRun ? "dry-run" : "MQTT " + opts.host + ":" + std::to_string(opts.port)) << '\n';

    std::vector<std::unique_ptr<device::TbDevice>> devices;
    std::vector<std::thread> threads;
    for (const auto& s : stations) {
        std::vector<sim::Fault> mine;
        for (const auto& f : faults)
            if (f.deviceId == s.deviceId) mine.push_back(f);
        devices.push_back(std::make_unique<device::TbDevice>(s, opts, factory, scenario, mine));
    }
    for (auto& d : devices) threads.emplace_back([&d] { d->run(gStop); });
    for (auto& t : threads) t.join();
    std::cout << "flood-sim: đã dừng\n";
    return 0;
}
