# Kế hoạch triển khai & danh sách function

Bổ sung cho [FINAL_PROJECT_DIRECTION.md](FINAL_PROJECT_DIRECTION.md). Trạng thái từng phần:

- ✅ **Nháp**: đã có code nhưng **chưa build/chạy thử**. Cần review, sửa lỗi biên dịch và test.
- 🔲 **Stub**: mới có chữ ký hàm và `TODO`, chưa có thân hàm.

## 1. Kiến trúc thư mục

```
floodsense-hcm/
├── docker-compose.yml        ThingsBoard (tb-postgres) + backend + frontend
├── core/                     Lõi logic C++17, không phụ thuộc thư viện ngoài
├── device-sim/               Giả lập fleet trên PC (CMake, Paho MQTT C++, nlohmann/json)
├── firmware/                 ESP32 (PlatformIO, Arduino), dùng lại core/
├── tools/make_scenario.py    Sinh kịch bản mưa/triều từ Open-Meteo
├── backend/  frontend/       Giữ từ repo cũ
└── rule-chains/              Rule chain alarm + Discord
```

Luồng dữ liệu: `Cảm biến (thật / giả lập) → core::FloodStation → MQTT → ThingsBoard → Rule chain (alarm, Discord) / REST → backend FastAPI → WebSocket → frontend`.

## 2. `core/` — dùng chung cho firmware và device-sim

| File | Function / lớp | Vai trò | Trạng thái |
|---|---|---|---|
| `types.hpp` | `FloodStatus`, `Thresholds`, `ReportIntervals`, `StationSettings`, `Telemetry`, `toString()` | Kiểu dữ liệu chung | ✅ |
| `interfaces.hpp` | `IClock`, `IDistanceSensor`, `IRainGauge`, `IAlarmOutput` | Lớp trừu tượng phần cứng (HAL) | ✅ |
| `median_filter.hpp` | `MedianFilter<N>::push()` | Lọc nhiễu siêu âm | ✅ |
| `classifier.cpp` | `classify(level, thresholds, previous)` | Phân loại SAFE/ALERT/WARNING/CRITICAL, có hysteresis | ✅ |
| | `reportIntervalSec(status, intervals)` | Chu kỳ gửi thích nghi | ✅ |
| `flood_station.cpp` | `FloodStation::sample()` | Đọc siêu âm, lọc, báo `sensor_fault` khi 5 lần timeout liên tiếp, phân loại, điều khiển đèn/còi | ✅ |
| | `shouldReport()` / `buildTelemetry()` / `markReported()` | Quyết định gửi (đổi trạng thái hoặc hết chu kỳ), tính cường độ mưa | ✅ |
| | `setThresholds()`, `setIntervals()`, `setSirenMuted()` | Cấu hình từ xa | ✅ |
| `tests/core_tests.cpp` | 3 test: hysteresis, lọc trung vị, luồng của trạm | Unit test | ✅ (đã chạy pass) |

## 3. `device-sim/` — giả lập trên PC

| File | Function / lớp | Vai trò | Trạng thái |
|---|---|---|---|
| `sim/station_config` | `loadStations(path)` | Đọc `config/stations.json` (50 trạm, tham số thủy văn) | ✅ |
| `sim/scenario` | `Scenario::fromCsv()`, `constant()`, `at(minute)` | Đọc kịch bản `minute,rain_mm_h,tide_m`, nội suy | ✅ |
| `sim/hydro_model` | `HydroModel::step(rain, tide, dtHours)` | Mô hình bể chứa: `dH/dt = kRain·R + kTide·max(0,T−T0) − kDrain·H` | ✅ |
| `sim/sim_hardware` | `SimDistanceSensor` | JSN-SR04T: nhiễu ±0.5 cm, vùng mù 25 cm, timeout 1% | ✅ |
| | `SimRainGauge` (0.2 mm/lần lật), `SilentAlarm`, `RealClock` | Các cảm biến còn lại | ✅ |
| `sim/fault_plan` | `parseFault("ID:sensor\|network:start[:dur]")`, `Fault::activeAt()` | Tiêm lỗi | ✅ |
| `mqtt/transport.hpp` | `ITransport` (connect, publish, subscribe, setMessageHandler) | Tách khỏi thư viện MQTT | ✅ |
| `mqtt/paho_transport` | `makePahoTransport()` | Paho async_client, QoS 1 có chờ PUBACK | ✅ (chưa build) |
| `mqtt/dry_run_transport` | `makeDryRunTransport()` | In payload ra màn hình, không cần ThingsBoard | ✅ |
| `device/telemetry_json` | `telemetryPayload()`, `clientAttributes()` | JSON giữ nguyên các key backend đang đọc | ✅ |
| `device/tb_device` | `obtainAccessToken()`, `provision()` | Lưu token trong `.sim-state/`, provision qua MQTT | ✅ |
| | `connectAndSubscribe()`, `onMessage()` | Subscribe RPC và shared attributes | ✅ |
| | `handleRpc()`: `getStatus`, `muteSiren`, `testSiren` | Lệnh điều khiển | ✅ |
| | RPC `setInterval`, `reboot` | | 🔲 |
| | `applySharedAttributes()`: `alert_cm`, `warning_cm`, `critical_cm` | Đổi ngưỡng từ xa | ✅ |
| | `advanceTick()`, `pollTelemetry()`, `run()` | Vòng lặp, kết nối lại có backoff, mất mạng do tiêm lỗi | ✅ |
| | Đệm dữ liệu khi mất mạng và gửi bù | | 🔲 |
| `main.cpp` | Các tham số CLI: `--config --scenario --count --only --host --port --speed --fault --dry-run` | Chạy mỗi trạm trên một thread | ✅ |
| `tests/sim_tests.cpp` | Test điểm cân bằng thủy văn, nội suy kịch bản, cấu hình, parse lỗi, trạm lên CRITICAL khi bão | Unit test | ✅ (chưa build) |
| `scenarios/*.csv` | `heavy_rain`, `normal`, `rain_plus_tide` | Số liệu **tự tạo**, cần thay bằng số liệu thật | ✅ |

Lệnh build dự kiến (chưa chạy thử):

```bash
cmake -S device-sim -B build/sim && cmake --build build/sim -j
```

```bash
cd device-sim && ../build/sim/flood-sim --dry-run --count 3 --speed 600
```

## 4. `firmware/` — ESP32 (toàn bộ là stub 🔲)

| Nhóm | Function | Ghi chú cài đặt |
|---|---|---|
| HAL (`hal/esp32_hal.*`) | `ArduinoClock::nowMs` | Đồng bộ NTP để có epoch ms |
| | `JsnSr04tSensor::readDistanceCm` | `pulseIn(echo, HIGH, 30000)`, `cm = us / 58` |
| | `TippingBucketGauge::begin/takeTipCount` | Ngắt `FALLING`, biến đếm `volatile`, chống dội 50 ms |
| | `LedBuzzerAlarm::show` | Đèn xanh/vàng/đỏ, còi kêu theo nhịp khi CRITICAL |
| Kết nối | `connectWifi`, `loadAccessToken` (NVS), `provisionDevice`, `connectMqtt` | Giống luồng trong `TbDevice` |
| Dữ liệu | `publishTelemetry`, `bufferOffline`, `flushOfflineBuffer` | Dùng cùng các key với `telemetry_json.cpp` |
| Điều khiển | `onMqttMessage`, `handleRpc`, `applySharedAttributes` | Cùng tập lệnh RPC và attribute với device-sim |
| Tại chỗ | `updateLcd` | LCD 1602 I2C (0x27, SDA 21, SCL 22); tắt còi qua RPC `muteSiren` |
| Wokwi | `diagram.json`, `wokwi.toml` | ✅ Mạch 5 khối: HC-SR04 (thay JSN-SR04T), nút nhấn giả gáo mưa, LCD I2C, 3 LED, buzzer |

## 5. ThingsBoard, backend, frontend

| Việc | Trạng thái |
|---|---|
| Device profile `flood-station`: bật provisioning, đặt ngưỡng alarm theo `water_level_cm` | 🔲 |
| Import `rule-chains/tb_flood_discord_alarm_rule_chain.json`, điền webhook | 🔲 |
| Rule phát hiện thiết bị mất kết nối (inactivity timeout) | 🔲 |
| Backend: API proxy RPC (`POST /api/v1/devices/{id}/rpc`) và đổi ngưỡng (`POST .../attributes`) | 🔲 |
| Backend: API lịch sử telemetry và lịch sử alarm | 🔲 |
| Frontend: trang chi tiết trạm (biểu đồ), lịch sử cảnh báo, trang quản trị | 🔲 |
| `tools/make_scenario.py`: `fetch_hourly_rain`, `write_csv` | 🔲 |

## 6. Thứ tự làm đề xuất

1. `docker compose up -d`, đăng nhập ThingsBoard, tạo device profile và provisioning key.
2. Build `device-sim`, chạy `--dry-run` để kiểm tra payload, sau đó chạy với ThingsBoard thật cho 1 trạm, rồi 50 trạm.
3. Kiểm tra backend/frontend hiển thị đúng 50 trạm (payload đã giữ nguyên các key cũ).
4. Rule chain alarm + Discord, rồi RPC/attributes từ dashboard.
5. Firmware: chạy trên Wokwi trước, sau đó nạp lên mạch thật.
6. Các trang web mới, kịch bản thật từ Open-Meteo, demo tiêm lỗi.
