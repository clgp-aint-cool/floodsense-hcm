# FloodSense HCM — Trạm quan trắc & cảnh báo ngập đô thị TP.HCM

Đồ án cuối kỳ môn **Vật Lí cho Công Nghệ Thông Tin**.

FloodSense HCM là hệ thống IoT theo dõi ngập theo thời gian thực. Mỗi trạm đo mực nước (cảm biến siêu âm) và lượng mưa (gáo lật), tự phân loại mức ngập rồi gửi dữ liệu qua MQTT lên **ThingsBoard**. ThingsBoard lưu dữ liệu và chạy rule chain cảnh báo (Discord, còi/đèn tại trạm). Một web bản đồ hiển thị tình trạng toàn thành phố.

Hệ thống gồm **1 trạm thật** (ESP32, chạy trên phần cứng hoặc giả lập Wokwi) và **khoảng 50 trạm giả lập** viết bằng C++ để thử ở quy mô thành phố.

| Thành viên | MSSV |
|---|---|
| Hà Gia Linh | 22127231 |
| Cao Lê Gia Phú | 23127535 |
| Khưu Ngọc Ý Vy | 23127145 |

## Kiến trúc

```
ESP32 (trạm thật / Wokwi) ─┐
                           ├─ MQTT ─► ThingsBoard ─► Rule chain ─► Discord, lệnh còi/đèn
device-sim (50 trạm C++) ──┘              │
                                          ▼ REST
                                  backend (FastAPI) ─► frontend (bản đồ React)
```

## Các thành phần

| Thư mục | Nội dung |
|---|---|
| `core/` | Lõi xử lý C++17 dùng chung cho firmware và giả lập: lọc nhiễu, phân loại mức ngập, máy trạng thái của trạm. Không phụ thuộc Arduino hay MQTT. |
| `firmware/` | Firmware ESP32 (PlatformIO, Arduino): đọc cảm biến, LCD, còi/đèn, kết nối ThingsBoard qua MQTT. Có `diagram.json` và `wokwi.toml` để chạy trên Wokwi. |
| `device-sim/` | Giả lập nhiều trạm bằng C++: mô hình mưa và triều, kịch bản CSV, tạo lỗi có chủ đích (mất mạng, hỏng cảm biến). Danh sách 50 trạm nằm trong `config/stations.json`. |
| `rule-chains/` | Rule chain ThingsBoard (JSON để import) cảnh báo ngập và mất kết nối qua Discord, kèm script Python để thử webhook. |
| `backend/` | API FastAPI đọc số đo mới nhất của các trạm từ ThingsBoard, đánh dấu trạm mất kết nối quá 2 phút; có REST và WebSocket `/ws/live`. Danh sách trạm lấy chung từ `device-sim/config/stations.json`. |
| `frontend/` | Web bản đồ React + Vite + Leaflet: vị trí và mức ngập từng trạm, danh sách trạm xếp theo mực nước. |
| `tools/` | `make_scenario.py`: sinh kịch bản mưa/triều từ dữ liệu thật cho device-sim. |
| `docs/` | Định hướng và kế hoạch thực hiện. |
| `report/` | Báo cáo LaTeX (XeLaTeX) và bản PDF. |
| `demo/` | Trang HTML mô phỏng hoạt động của một trạm. |
| `22127231_23127145_23127535/` | Bài nộp: slide thuyết trình (HTML) và báo cáo PDF. |

## Khởi chạy

### 1. Hạ tầng (ThingsBoard + backend + frontend)

Yêu cầu: Docker và Docker Compose.

```bash
cp .env.example .env
docker compose up -d
```

| Dịch vụ | Địa chỉ |
|---|---|
| ThingsBoard | http://localhost:8080 (`tenant@thingsboard.org` / `tenant`), lần đầu mất 1–3 phút để khởi tạo |
| MQTT | `localhost:1883` |
| Backend | http://localhost:8000 |
| Web bản đồ | http://localhost:3000 |

Sau đó trong ThingsBoard:
1. Tạo Device Profile `flood-station`, bật provisioning, chép key/secret vào `.env`.
2. Import `rule-chains/tb_flood_discord_alarm_rule_chain.json` và điền webhook Discord.

### 2. Giả lập trạm (device-sim)

Yêu cầu: CMake ≥ 3.16 và trình biên dịch C++17. Thư viện JSON và Paho MQTT được tải tự động khi build.

```bash
cmake -S device-sim -B build
cmake --build build -j
cd device-sim && ../build/flood-sim --scenario scenarios/heavy_rain.csv --count 50
```

Một số tùy chọn (xem đủ bằng `--help`):
- `--dry-run`: không kết nối MQTT, chỉ in dữ liệu ra màn hình.
- `--speed 60`: tua nhanh kịch bản (1 giờ chạy trong 1 phút).
- `--fault VN-HCM-001:network:10:5`: tạo lỗi mất mạng ở phút 10, kéo dài 5 phút.

Chạy test: `ctest --test-dir build`.

### 3. Firmware ESP32

Yêu cầu: PlatformIO.

```bash
cd firmware
pio run                 # build
pio run -t upload       # nạp vào ESP32
```

Để chạy trên Wokwi: mở thư mục `firmware/` trong VS Code có extension Wokwi, build bằng `pio run` rồi chọn *Wokwi: Start Simulator*.

### 4. Chạy riêng backend / frontend khi phát triển

```bash
# backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm install && npm run dev
```

## Giấy phép

Xem [LICENSE](LICENSE).
