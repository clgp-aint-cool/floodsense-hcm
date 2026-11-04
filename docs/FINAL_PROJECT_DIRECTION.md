# Định hướng đồ án cuối kỳ — Hệ thống cảnh báo ngập TP.HCM (bản IoT-first)

> Mục tiêu tài liệu: chuyển repo hiện tại (nặng về hạ tầng K8s/GitOps/CI-CD của bài LAB trước) sang một đồ án **tập trung vào chức năng IoT**: thiết bị (firmware C++), giả lập thiết bị bằng C++, ThingsBoard, rule chain cảnh báo và web dashboard. Hạ tầng chỉ cần **1 file `docker-compose.yml`** chạy được trên laptop.

---

## 1. Tên sản phẩm & lý do (gợi ý cho báo cáo)

**Tên đề xuất:** *FloodSense HCM — Trạm quan trắc & cảnh báo ngập đô thị thông minh*

**Lý do thực hiện (ý chính để viết):**
- TP.HCM ngập thường xuyên do 3 yếu tố cộng dồn: **mưa lớn cục bộ + triều cường + hệ thống thoát nước quá tải**. Người dân chỉ biết điểm ngập khi đã đi tới.
- Thông tin ngập hiện tại chủ yếu đến từ mạng xã hội, không có số liệu theo thời gian thực theo từng tuyến đường.
- Một trạm cảm biến giá rẻ (~1 triệu đồng) đặt tại các "rốn ngập" có thể đo mực nước, lượng mưa và gửi về server mỗi vài giây → bản đồ ngập realtime + cảnh báo sớm.
- Đề tài kết hợp đủ các mảng của môn IoT: cảm biến, vi điều khiển, giao thức MQTT, IoT platform, rule engine, dashboard/web, cảnh báo đa kênh.

---

## 2. Nguồn dữ liệu giả lập (data giả) — lấy từ đâu?

Nguyên tắc: **dữ liệu giả nhưng phải có "căn cứ"**. Thay vì random hoàn toàn như simulator Python hiện tại (`sin + random`), nên ghép từ dữ liệu thật/công khai + mô hình vật lý đơn giản. Khi vấn đáp, nhóm giải thích được "số này lấy từ đâu".

### 2.1 Dữ liệu mưa & thời tiết (thật, miễn phí, không cần API key)

| Nguồn | Dùng để làm gì | Ghi chú |
|---|---|---|
| **Open-Meteo Historical Weather API** — https://open-meteo.com/en/docs/historical-weather-api | Lấy **lượng mưa theo giờ** của TP.HCM các trận mưa lớn trong quá khứ (VD: các trận mưa tháng 9–11 hằng năm) → xuất CSV làm **kịch bản (scenario)** cho simulator replay | Backend đã dùng Open-Meteo cho thời tiết hiện tại, tận dụng lại được |
| **Open-Meteo Forecast API** — https://open-meteo.com/en/docs | Chế độ "live": simulator lấy mưa dự báo hiện tại làm đầu vào | Có biến `precipitation`, `rain`, `temperature_2m`, `relative_humidity_2m` |
| **MET Norway Locationforecast** — https://api.met.no | Nguồn dự phòng (backend đã tích hợp) | Bắt buộc gửi header `User-Agent` |
| **Copernicus ERA5** — https://cds.climate.copernicus.eu | (Tùy chọn, nâng cao) dữ liệu khí hậu nhiều năm | Cần đăng ký, file NetCDF, nặng |
| **NASA GPM IMERG** — https://gpm.nasa.gov/data | (Tùy chọn) mưa vệ tinh 30 phút/lần | Cần tài khoản Earthdata |
| **Kaggle** — tìm "Vietnam weather", "Ho Chi Minh rainfall" | Dataset CSV có sẵn, dễ dùng nhất cho demo offline | Ghi rõ tên dataset + tác giả trong tài liệu tham khảo |

### 2.2 Dữ liệu triều cường

| Nguồn | Cách dùng |
|---|---|
| **Đài KTTV khu vực Nam Bộ** (kttvnb.vn) và **Trung tâm Dự báo KTTV quốc gia** (nchmf.gov.vn) | Bản tin/bảng dự báo triều trạm **Phú An, Nhà Bè, Vũng Tàu**: lấy đỉnh triều vài ngày → nhập tay thành CSV |
| **Tự sinh triều bằng mô hình điều hòa (harmonic)** | `h(t) = Z0 + Σ Aᵢ·cos(ωᵢ·t + φᵢ)` với các sóng chính M2 (12.42h), S2 (12h), K1 (23.93h), O1 (25.82h). Biên độ chỉnh sao cho đỉnh triều ~1.4–1.7 m (mức triều cường mùa khô cuối năm ở HCM) |
| Thư viện Python `utide` / `pyTMD` (tùy chọn) | Nếu muốn tính hằng số điều hòa từ chuỗi số liệu thật |

### 2.3 Vị trí điểm ngập (để đặt trạm trên bản đồ)

- **Danh sách điểm ngập** do Trung tâm Quản lý hạ tầng kỹ thuật TP.HCM / Sở Xây dựng công bố trên báo chí hằng năm (tìm "danh sách điểm ngập TP.HCM 202x").
- **OpenStreetMap** (https://www.openstreetmap.org, Overpass API https://overpass-turbo.eu) để lấy tọa độ chính xác của đường/giao lộ.
- **HDX – Humanitarian Data Exchange** (https://data.humdata.org) tìm "Viet Nam flood" — có lớp dữ liệu vùng ngập/ranh giới hành chính.
- Repo **đã có sẵn 50 trạm** với tọa độ thật ở `simulator/single_device_simulator.py` (`ALL_50_STATIONS`) → chuyển thành `stations.json` để C++ đọc.

### 2.4 Đặc tính cảm biến (để mô phỏng nhiễu cho "giống thật")

Lấy từ **datasheet** của chính linh kiện sẽ mua (trích dẫn được trong báo cáo):

| Cảm biến | Đặc tính cần mô phỏng |
|---|---|
| JSN-SR04T (siêu âm chống nước) | Tầm đo ~25–450 cm, sai số ~±1 cm, **vùng mù ~25 cm**, thỉnh thoảng trả 0/timeout |
| Rain gauge kiểu gáo lật (tipping bucket) | Mỗi lần lật = **0.2794 mm** (hoặc 0.2 mm tùy loại) → mưa là số xung đếm được, không phải số thực liên tục |

### 2.5 Mô hình sinh mực nước (tank model đơn giản)

Thay vì `sin + random`, mỗi trạm là một "bể chứa":

```
dH/dt = k_rain · R(t)            // mưa làm nước dâng (R: mm/h từ CSV/Open-Meteo)
      + k_tide · max(0, T(t) - T0) // triều vượt cao độ cửa xả → nước tràn ngược
      - k_drain · H                // cống thoát nước theo tỉ lệ mực nước
```

- `k_rain`, `k_drain`, `T0` khác nhau theo từng trạm (rốn ngập thì `k_drain` nhỏ) → cùng một trận mưa nhưng mỗi trạm ngập khác nhau, **hợp lý khi nhìn trên bản đồ**.
- Sau khi có `H` thật → đưa qua **mô hình cảm biến** (cộng nhiễu ±1 cm, vùng mù, lỗi đọc) → ra giá trị "cảm biến đo được".

### 2.6 Kịch bản demo (scenario) nên chuẩn bị

| File | Nội dung | Mục đích khi vấn đáp |
|---|---|---|
| `normal.csv` | Trời khô, triều thấp | Hệ thống ổn định, tất cả SAFE |
| `heavy_rain.csv` | Replay trận mưa lớn thật từ Open-Meteo | Mực nước dâng dần → ALERT → WARNING → CRITICAL, thấy alarm |
| `rain_plus_tide.csv` | Mưa trùng giờ triều cường | Ngập kéo dài, nước rút chậm |
| `sensor_fault` | Siêu âm trả 0 / mất kết nối | Kiểm tra phát hiện thiết bị lỗi, OFFLINE |

### 2.7 Giả lập phần cứng thật bằng C++ (không cần mua đồ để demo trước)

- **Wokwi** (https://wokwi.com, https://docs.wokwi.com) — giả lập ESP32 chạy **code Arduino C++ thật**, có sẵn đủ 5 khối của trạm: HC-SR04 (cùng giao thức JSN-SR04T), nút nhấn (giả xung gáo mưa), LCD 1602 I2C, LED, buzzer — mạch nằm ở `firmware/diagram.json`; có WiFi giả (`Wokwi-GUEST`) kết nối MQTT ra internet. Dùng extension Wokwi cho VS Code + PlatformIO để build cùng code với mạch thật.
- **Desktop C++ simulator** (mục 4) — chạy hàng chục thiết bị trên laptop để tạo tải và dữ liệu bản đồ.

> Chiến lược: **1 firmware C++ dùng chung lõi logic**, chạy được ở 3 nơi: Wokwi → ESP32 thật → PC (fleet giả lập).

---

## 3. Tinh gọn repo: bỏ hạ tầng, chỉ giữ IoT

### 3.1 Phân loại thư mục hiện tại

| Thư mục / file | Nội dung | Quyết định |
|---|---|---|
| `helm/` (thingsboard, observability, infra-alerts, hcm-flood-*) | Helm chart K8s | ❌ **Xóa** |
| `gitops/` | ArgoCD/Devtron Application | ❌ **Xóa** |
| `ingress/` | NGINX ingress, MQTT LoadBalancer | ❌ **Xóa** |
| `.github/workflows/`, `.github/security/`, `.github/notifications/` | CI/CD, Semgrep/Trivy, Discord CI | ❌ **Xóa** |
| `tools/kafka/`, `tools/validate_infra_alerts.py`, `tools/validate_discord_alerts.py` | Kafka partition, alert hạ tầng | ❌ **Xóa** |
| `tools/test_flood_discord_alert.py` | Test gửi cảnh báo ngập lên Discord | ✅ Giữ (chuyển vào `rule-chains/`) |
| `.env` (PLATFORM, DEPLOYMENT_TYPE, CASSANDRA…) | Config triển khai K8s | ❌ Xóa, thay bằng `.env.example` mới |
| `AI_LAB_INSTRUCTIONS.md`, `BITNAMI-IMAGE-MIGRATION.md` | Hướng dẫn bài LAB CMC Cloud | ❌ **Xóa** |
| `docs/BASTION_DEMO_RUNBOOK.md`, `HELM_MANUAL_SCALING.md`, `INFRA_TESTING_AND_IMPROVEMENT_PLAN.md`, `SYSTEM_TRAFFIC_ARCHITECTURE.md`, `gitops-promotion.md`, `security-pipeline.md`, `discord-notifications.md` (phần CI) | Tài liệu hạ tầng | ❌ **Xóa** |
| `docs/SYSTEM_FLOW.md`, `PRESENTATION_OUTLINE.md`, `SYSTEM_TESTING_PLAN.md`, `STEP_BY_STEP_TESTING_GUIDE.md` | Có phần IoT lẫn hạ tầng | ✏️ Viết lại theo kiến trúc mới |
| `backend/` (FastAPI: dashboard, weather, tide, devices, WebSocket) | Lớp API cho web | ✅ Giữ, đổi default `THINGSBOARD_URL` thành `http://thingsboard:8080` |
| `frontend/` (React + Vite + bản đồ) | Web | ✅ Giữ, mở rộng chức năng |
| `rule-chains/tb_flood_discord_alarm_rule_chain.json` | Rule chain alarm + Discord | ✅ Giữ, mở rộng |
| `simulator/` (Python, 50 trạm, compose fleet) | Giả lập cũ | 🔁 Thay bằng C++; giữ `stations` data → `stations.json` |
| `.agents/rules/ui_design.md` | Rule thiết kế UI | ✅ Giữ |

### 3.2 Cấu trúc repo mới đề xuất

```
iot-thingsboard/
├── docker-compose.yml          # ThingsBoard + backend + frontend (hạ tầng duy nhất)
├── .env.example                # TB_USER, TB_PASS, PROVISION_KEY/SECRET, DISCORD_WEBHOOK...
├── firmware/                   # Code ESP32 thật (PlatformIO, Arduino C++)
│   ├── platformio.ini
│   ├── wokwi.toml + diagram.json   # chạy giả lập trên Wokwi
│   ├── src/main.cpp
│   └── lib/                    # dùng chung với device-sim (xem 4.1)
├── device-sim/                 # Giả lập thiết bị trên PC (C++17, CMake)
│   ├── CMakeLists.txt
│   ├── include/  src/  tests/
│   ├── config/stations.json
│   └── scenarios/*.csv
├── core/                       # Lõi logic C++ dùng chung firmware + device-sim
├── backend/                    # FastAPI (giữ)
├── frontend/                   # React (giữ)
├── rule-chains/                # Export JSON rule chain + dashboard TB
└── docs/                       # Báo cáo, sơ đồ, hướng dẫn chạy
```

### 3.3 Hạ tầng tối giản (`docker-compose.yml`)

```yaml
services:
  thingsboard:
    image: thingsboard/tb-postgres:latest   # ThingsBoard CE + PostgreSQL trong 1 container
    ports: ["8080:9090", "1883:1883"]
    environment:
      TB_QUEUE_TYPE: in-memory              # không cần Kafka
    volumes:
      - tb-data:/data
      - tb-logs:/var/log/thingsboard

  backend:
    build: ./backend
    environment:
      THINGSBOARD_URL: http://thingsboard:9090
      THINGSBOARD_USERNAME: ${TB_USER}
      THINGSBOARD_PASSWORD: ${TB_PASS}
    ports: ["8000:8000"]
    depends_on: [thingsboard]

  frontend:
    build: ./frontend
    ports: ["5173:80"]
    depends_on: [backend]

volumes: { tb-data: {}, tb-logs: {} }
```

> Lưu ý: image `tb-postgres` lần đầu cần chạy với `INSTALL_TB=true LOAD_DEMO=true` (xem https://thingsboard.io/docs/user-guide/install/docker/). Tài khoản mặc định `tenant@thingsboard.org / tenant`. Kiểm tra lại cổng HTTP nội bộ của image theo phiên bản dùng (9090 hoặc 8080).

**Không còn:** Kubernetes, Helm, ArgoCD, Kafka, Redis cluster, Cassandra, Loki/Grafana, Palo Alto, Kyverno, NetworkPolicy, CI/CD.

---

## 4. Thiết kế phần C++ (trọng tâm đồ án)

### 4.1 Ý tưởng then chốt: tách lõi logic khỏi phần cứng (HAL)

```
              ┌──────────────── core/ (C++17, không phụ thuộc Arduino) ────────────────┐
              │  FloodStation: đọc sensor → lọc → phân loại mức → quyết định cảnh báo  │
              │  ThresholdConfig, StatusClassifier, MedianFilter, TelemetryBuilder     │
              │  Interfaces: IDistanceSensor, IRainGauge, IClock, IAlarmOutput         │
              │  (MQTT tách riêng: ITransport)                                         │
              └───────────────▲─────────────────────────────────▲──────────────────────┘
                              │                                 │
       firmware/ (ESP32)      │                                 │   device-sim/ (PC)
  JsnSr04tSensor (pulseIn)    │                                 │  SimWaterLevelSensor (tank model + nhiễu)
  TippingBucket (interrupt)   │                                 │  SimRainGauge (CSV/Open-Meteo → xung)
  PubSubClientMqtt            │                                 │  PahoMqtt (paho-mqtt-cpp) / mosquitto
  LedBuzzerLcdAlarm           │                                 │  ConsoleAlarm (in log màu)
```

→ Khi vấn đáp: "code giả lập và code mạch thật **dùng chung 1 lõi**, chỉ khác lớp phần cứng". Unit test (GoogleTest/Catch2) chạy cho lõi trên PC.

### 4.2 Các lớp chính trong `device-sim/`

| Lớp | Trách nhiệm |
|---|---|
| `StationConfig` | Đọc `stations.json` (id, tên, tọa độ, quận, `k_rain`, `k_drain`, ngưỡng) |
| `ScenarioSource` | Đọc CSV (`timestamp, rain_mm_h, tide_m`) hoặc gọi Open-Meteo; hỗ trợ **tua nhanh** (`--speed 60` = 1 giờ thật chạy trong 1 phút) |
| `HydroModel` | Tank model ở mục 2.5, bước tích phân Euler |
| `SimWaterLevelSensor` | Đổi mực nước → khoảng cách siêu âm (`mount_height - H`), cộng nhiễu, vùng mù, lỗi timeout |
| `SimRainGauge` | Chuyển mm/h → số lần lật gáo trong chu kỳ |
| `FaultInjector` | Bật lỗi theo kịch bản: mất mạng, cảm biến siêu âm mất xung |
| `TbDevice` | Máy trạng thái: `BOOT → PROVISION → CONNECT → ONLINE ⇄ RECONNECT`; publish telemetry/attributes; nhận RPC |
| `Fleet` | Chạy N `TbDevice` (thread pool hoặc event loop), lệnh CLI `--count 50 --scenario heavy_rain.csv` |

### 4.3 Giao tiếp với ThingsBoard (MQTT API)

| Chức năng | Topic | Ghi chú |
|---|---|---|
| Tự đăng ký thiết bị | `/provision/request` → `/provision/response` (username `provision`) | Code Python hiện tại đã làm, port sang C++ |
| Gửi telemetry | `v1/devices/me/telemetry` | **Giữ nguyên schema** payload hiện tại để backend/frontend không phải sửa: `device_id, device_name, latitude, longitude, water_level_cm, rainfall_mm, status, district, parent_*`... (bỏ `temperature_c`, backend đã bọc try/except nên không lỗi). Thêm: `rssi`, `distance_raw_cm`, `sensor_fault` |
| Gửi thuộc tính tĩnh | `v1/devices/me/attributes` | firmware version, vị trí lắp, chiều cao lắp cảm biến |
| Nhận cấu hình ngưỡng | subscribe `v1/devices/me/attributes` (shared attributes) | Đổi ngưỡng ALERT/WARNING/CRITICAL, chu kỳ gửi từ dashboard không cần nạp lại code |
| Nhận lệnh điều khiển | `v1/devices/me/rpc/request/+` → trả `v1/devices/me/rpc/response/{id}` | `setInterval`, `testSiren`, `muteSiren`, `reboot`, `getStatus` |
| OTA (tùy chọn, điểm cộng) | `v2/fw/request/...` | ThingsBoard OTA updates cho ESP32 |

Thư viện gợi ý:
- PC: **Eclipse Paho MQTT C++** (https://github.com/eclipse/paho.mqtt.cpp) hoặc **libmosquitto**; JSON: **nlohmann/json**; CLI: **CLI11**; test: **Catch2/GoogleTest**. Quản lý bằng CMake `FetchContent` hoặc vcpkg.
- ESP32: **PubSubClient** hoặc **ThingsBoard Arduino SDK** (https://github.com/thingsboard/thingsboard-client-sdk), **ArduinoJson**.

### 4.4 Logic tại thiết bị (edge) — điểm cộng khi vấn đáp

- **Lọc nhiễu**: median 5 mẫu cho siêu âm, loại giá trị ngoài vùng đo.
- **Phát hiện cảm biến lỗi**: siêu âm timeout 5 lần liên tiếp (đứt dây, đầu dò ngập) → không tính mực nước, gửi `sensor_fault`.
- **Gửi thích nghi**: SAFE gửi 60 s/lần, ALERT 10 s, CRITICAL 2 s → tiết kiệm pin/băng thông.
- **Báo ngay khi đổi trạng thái** (report-by-exception) thay vì chờ chu kỳ.
- **Cảnh báo cục bộ** khi mất mạng: còi + đèn vẫn hoạt động; **đệm dữ liệu** (ring buffer) và gửi bù khi có mạng lại.
- **Watchdog** + tự kết nối lại có backoff.

---

## 5. Bảng chức năng dự kiến (nguyên liệu cho mục "Bảng tóm tắt chức năng")

### 5.1 Thiết bị (trạm quan trắc)
1. Đo mực nước bằng cảm biến siêu âm chống nước
2. Đo lượng mưa (gáo lật, đếm xung ngắt)
3. Lọc nhiễu và phân loại mức ngập (SAFE / ALERT / WARNING / CRITICAL)
4. Cảnh báo tại chỗ: đèn 3 màu + còi
5. Hiển thị LCD: mực nước, trạng thái, lượng mưa, WiFi
6. Tự đăng ký (provisioning) lên ThingsBoard
7. Gửi telemetry MQTT với chu kỳ thích nghi
8. Nhận cấu hình ngưỡng từ xa (shared attributes)
9. Nhận lệnh RPC (thử còi, tắt còi, đổi chu kỳ, khởi động lại)
10. Lưu đệm khi mất mạng, gửi bù
11. Tự kết nối lại WiFi/MQTT, watchdog
12. (Tùy chọn) Cập nhật firmware OTA

### 5.2 Nền tảng ThingsBoard
13. Quản lý thiết bị, device profile, nhóm theo quận
14. Rule chain: tạo/xóa alarm theo ngưỡng mực nước
15. Rule chain: phát hiện thiết bị mất kết nối (inactivity timeout)
16. Gửi thông báo Discord/Telegram/Email khi CRITICAL
17. Dashboard nội bộ cho quản trị viên (bảng thiết bị, đồ thị, nút RPC)

### 5.3 Web (backend FastAPI + frontend React)
18. Bản đồ realtime các trạm, màu theo mức ngập (đã có)
19. Thanh bên danh sách trạm, lọc theo quận/mức độ (đã có)
20. Xem chi tiết trạm + biểu đồ lịch sử mực nước/mưa
21. Thông tin thời tiết hiện tại (Open-Meteo/MET Norway — đã có)
22. Biểu đồ triều (đã có khung `TideChart`)
23. Danh sách điểm ngập nghiêm trọng (`/api/v1/severe-locations` — đã có)
24. Cập nhật realtime qua WebSocket `/ws/live` (đã có)
25. Trang lịch sử cảnh báo (alarm log)
26. Trang quản trị: đổi ngưỡng, gửi lệnh thử còi (gọi RPC qua backend)
27. (Tùy chọn) Gợi ý tuyến đường tránh điểm ngập
28. (Tùy chọn) Người dân đăng ký nhận cảnh báo theo khu vực

### 5.4 Công cụ giả lập
29. Giả lập fleet N trạm bằng C++, chạy theo kịch bản CSV
30. Tiêm lỗi (mất mạng, cảm biến hỏng)
31. Chạy firmware trên Wokwi không cần phần cứng

---

## 6. Danh sách linh kiện dự kiến (1 trạm mẫu)

> Giá **ước tính, phải kiểm tra lại** trên trang bán trước khi nộp và chụp màn hình/ghi ngày truy cập làm trích dẫn. Nguồn gợi ý: Hshop.vn, ICDayRoi.com, Thegioiic.com, Nshop, Shopee/Lazada (shop có hóa đơn).

| # | Linh kiện | SL | Giá ước tính (VNĐ) |
|---|---|---|---|
| 1 | ESP32 DevKit V1 (ESP-WROOM-32) | 1 | 100.000 – 150.000 |
| 2 | Cảm biến siêu âm chống nước JSN-SR04T | 1 | 120.000 – 180.000 |
| 3 | Rain gauge gáo lật (hoặc module cảm biến mưa YL-83 nếu thiếu kinh phí) | 1 | 300.000 – 600.000 (YL-83: ~20.000) |
| 4 | LCD 16x2 + module I2C | 1 | 50.000 – 70.000 |
| 5 | LED đỏ/vàng/xanh + điện trở | 1 bộ | 5.000 – 10.000 |
| 6 | Còi buzzer 5V | 1 | 5.000 – 15.000 |
| 7 | Pin 18650 + đế pin | 2 | 80.000 – 120.000 |
| 8 | Mạch sạc TP4056 + mạch boost/buck 5V | 1 | 20.000 – 40.000 |
| 9 | (Tùy chọn) Tấm pin mặt trời 6V 2W | 1 | 80.000 – 120.000 |
| 10 | Hộp nhựa chống nước IP65 | 1 | 50.000 – 100.000 |
| 11 | Breadboard/PCB đục lỗ, dây cắm, ốc vít | 1 bộ | 50.000 |
| | **Tổng ước tính** | | **~860.000 – 1.460.000** |

Bản vẽ phác thảo (yêu cầu tự vẽ, không dùng ảnh có sẵn): có thể vẽ bằng draw.io/Fritzing/Tinkercad. Gợi ý bố cục: hộp IP65 gắn trên cột, cảm biến siêu âm chĩa thẳng xuống mặt đường, rain gauge trên đỉnh, đèn/còi mặt trước, pin mặt trời mái nghiêng. Sơ đồ mạch Wokwi (`diagram.json`) cũng xuất được làm hình cấu trúc bên trong.

---

## 7. Lộ trình gợi ý (3 thành viên — điều chỉnh theo nhóm)

| Tuần | TV1 — Firmware/Phần cứng | TV2 — Giả lập C++ & ThingsBoard | TV3 — Backend/Web |
|---|---|---|---|
| 1 | Chọn linh kiện, mạch Wokwi | Dọn repo (mục 3), dựng docker-compose, cấu hình TB + device profile | Đổi config backend sang compose, chạy lại frontend |
| 2 | `core/` + đọc siêu âm trên Wokwi | `device-sim`: CMake, Paho, provisioning, gửi telemetry 1 trạm | Trang chi tiết trạm + biểu đồ lịch sử |
| 3 | Rain gauge (ngắt), LCD, đèn/còi | Tank model + scenario CSV từ Open-Meteo, fleet 50 trạm | Trang lịch sử alarm |
| 4 | Shared attributes, RPC, đệm offline | Rule chain alarm, inactivity, Discord/Telegram | Trang quản trị: đổi ngưỡng, gửi RPC |
| 5 | Lắp mạch thật, đóng hộp | Fault injector, unit test lõi C++ | Hoàn thiện UI, kiểm thử end-to-end |
| 6 | Quay video demo phần cứng | Kịch bản demo vấn đáp | Báo cáo PDF + slide PPTX (cả nhóm) |

---

## 8. Việc tiếp theo

1. Nhóm duyệt bảng ở mục 3.1 → tạo branch, xóa các thư mục hạ tầng, thêm `docker-compose.yml` gốc.
2. Chuyển `ALL_50_STATIONS` sang `device-sim/config/stations.json`.
3. Dựng khung `core/` + `device-sim/` (CMake) và port luồng provisioning + telemetry từ Python sang C++.
4. Lấy 1 trận mưa lớn thật từ Open-Meteo Historical → `scenarios/heavy_rain.csv`.
