# Kế Hoạch & Mô Hình Kiểm Thử Toàn Diện Hệ Thống (System Testing Plan & Acceptance Criteria)

> **Đề tài**: Triển Khai Hệ Thống IoT Cảnh Báo Ngập Và Thời Tiết Cho TP.HCM Trên Nền Tảng CMC Cloud  
> **Phiên bản tài liệu**: 1.0 — 2026-10-16  
> **Tham chiếu kiến trúc**: [SYSTEM_FLOW.md](file:///c:/Users/Admin/Downloads/iot/iot-thingsboard/docs/SYSTEM_FLOW.md), [SYSTEM_TRAFFIC_ARCHITECTURE.md](file:///c:/Users/Admin/Downloads/iot/iot-thingsboard/docs/SYSTEM_TRAFFIC_ARCHITECTURE.md)  
> **Căn cứ yêu cầu**: Đề tài LAB cuối khóa — Mục 10: "Mô hình sau triển khai & nghiệm thu"

---

## 1. TỔNG QUAN MÔ HÌNH KIỂM THỬ (TESTING FRAMEWORK)

Mô hình kiểm thử được thiết kế theo hình tháp chuẩn quốc tế (V-Model & Cloud Architecture Verification), bao gồm 6 lớp kiểm thử độc lập và liên kết chặt chẽ:

```
                      ┌──────────────────────────────────────┐
                      │  6. Nghiệm thu & UAT (Acceptance)    │
                      ├──────────────────────────────────────┤
                      │  5. Khả năng Chịu lỗi & HA/Failover  │
                      ├──────────────────────────────────────┤
                      │  4. Hiệu năng & Chịu tải (Stress)    │
                      ├──────────────────────────────────────┤
                      │  3. Kiểm thử 6 Luồng E2E Ứng dụng    │
                      ├──────────────────────────────────────┤
                      │  2. Nền tảng K8s CKE & Bảo mật Pod   │
                      ├──────────────────────────────────────┤
                      │  1. Hạ tầng Cloud & Mạng (VPC/FW/LB) │
                      └──────────────────────────────────────┘
```

| Cấp độ | Phạm vi kiểm thử | Mục tiêu chính | Công cụ thực hiện |
|---|---|---|---|
| **Lớp 1: Hạ tầng Cloud** | VPC, Subnet, Palo Alto FW HA, ILBs, DBaaS, S3, Cinder PV | Đảm bảo kết nối mạng phân lớp và an ninh biên đúng thiết kế | `ping`, `traceroute`, `curl`, `nc`, PA WebUI |
| **Lớp 2: Cụm K8s CKE** | NodeGroups, NetworkPolicy, Kyverno, HPA, RBAC | Đảm bảo tính cô lập, tuân thủ an toàn thông tin container | `kubectl`, `kyverno cli`, K8s Event log |
| **Lớp 3: Luồng Nghiệp vụ** | 6 luồng hoạt động chính của hệ thống IoT | Dữ liệu cảm biến vào DB, dashboard hiển thị, cảnh báo kích hoạt | MQTTX, Postman, Web Browser, Telegram |
| **Lớp 4: Hiệu năng/Tải** | Khả năng chịu tải đồng thời của MQTT, Ingress, Kafka | Xác định ngưỡng giới hạn chịu tải trong mùa mưa bão | `k6`, `JMeter`, `emqtt_bench` |
| **Lớp 5: HA & Chaos** | Tự phục hồi khi chết Node, Pod, Failover Firewall | Cam kết độ sẵn sàng cao (High Availability 99.9%) | K8s Pod deletion, Node drain, PA Link drop |
| **Lớp 6: Nghiệm thu** | Bộ tiêu chí theo Đề tài LAB cuối khóa | Nghiệm thu bàn giao hệ thống đạt chuẩn CMC Cloud | Acceptance Checklist |

---

## 2. LỚP 1: KIỂM THỬ HẠ TẦNG CLOUD & AN NINH MẠNG (INFRASTRUCTURE TESTING)

### 2.1. Kiểm thử phân hoạch mạng VPC & Định tuyến (VPC & Subnet Isolation)

| Mã TC | Hạng mục | Điều kiện kiểm thử | Các bước thực hiện | Kết quả mong đợi | Đánh giá |
|---|---|---|---|---|---|
| **INF-NET-01** | Kiểm tra phân giải & IP Subnet | VPC `vpc-lab (10.0.0.0/16)` | Đứng từ Bastion kiểm tra các dải mạng: Untrust (`10.0.1.0/24`), Trust (`10.0.2.0/24`), DBaaS (`10.0.3.0/24`) | Các dải subnet được cấp phát chuẩn xác, không chồng lấn IP | [ ] Pass<br>[ ] Fail |
| **INF-NET-02** | Cô lập Subnet Private | Worker Node K8s | Ping thử từ ngoài Internet vào IP Private của Worker Node (`10.0.2.x`) | Kết quả `Request timed out` (Chặn 100%, không lộ IP Public) | [ ] Pass<br>[ ] Fail |
| **INF-NET-03** | Định tuyến qua Firewall | Traffic từ Trust ra Internet | `curl -I https://google.com` từ Worker Node | Traffic bắt buộc phải đi qua Next-hop là Palo Alto Firewall Trust Interface | [ ] Pass<br>[ ] Fail |

### 2.2. Kiểm thử Tường lửa Palo Alto HA (Active/Passive Failover & L7 Security)

| Mã TC | Hạng mục | Kịch bản kiểm thử | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| **INF-FW-01** | Đồng bộ cấu hình HA (Config Sync) | Tạo 1 rule mới trên PA-FW1 (Active) | PA-FW2 (Passive) tự động đồng bộ rule sau < 5 giây qua liên kết HA | [ ] Pass |
| **INF-FW-02** | Tự động chuyển đổi dự phòng (Failover) | Tắt cổng mạng hoặc tắt nguồn máy ảo PA-FW1 | PA-FW2 lập tức chuyển sang trạng thái `Active`, thời gian rớt gói tin < 3 giây | [ ] Pass |
| **INF-FW-03** | Lọc L7 & Chặn tấn công (IPS/Anti-DDoS) | Gửi payload SQL Injection/XSS giả lập qua cổng HTTP 443 | Palo Alto Firewall phát hiện chữ ký tấn công, drop gói tin và ghi log Threat Alert | [ ] Pass |
| **INF-FW-04** | Kiểm tra cổng mở ra ngoài | Dùng `nmap` quét toàn bộ dải IP Public của hệ thống | Chỉ mở duy nhất: Port 80, 443 (Web/API), Port 1883 (MQTT), Port 82/443 (VPN Admin). Mọi port khác bị đóng/drop | [ ] Pass |

### 2.3. Kiểm thử Cân bằng tải nội bộ (Internal Load Balancer - ILB)

| Mã TC | Hạng mục | Kịch bản kiểm thử | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| **INF-LB-01** | ILB Ingress (`10.0.2.192`) | Gửi request HTTP/HTTPS tới IP `10.0.2.192` | Chuyển tiếp thành công đến NGINX Ingress Controller Pods trên System NodeGroup | [ ] Pass |
| **INF-LB-02** | ILB MQTT (`10.0.2.193`) | Kết nối socket TCP port 1883 tới IP `10.0.2.193` | Cân bằng tải đều đến 2 Pods `tb-mqtt-transport` trên Workload NodeGroup | [ ] Pass |
| **INF-LB-03** | ILB Health Check | Tắt 1 Pod Backend/Transport | ILB tự động loại bỏ endpoint lỗi trong 5s, không định tuyến request vào pod chết | [ ] Pass |

### 2.4. Kiểm thử Dịch vụ Cơ sở dữ liệu & Lưu trữ (DBaaS & Storage)

| Mã TC | Dịch vụ | Kịch bản kiểm thử | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| **INF-DB-01** | PostgreSQL (CMC DBaaS) | Kết nối từ Pod `tb-node` tới `10.0.3.x:5432` | Kết nối thành công, xác thực đúng tài khoản ThingsBoard DB | [ ] Pass |
| **INF-DB-02** | PostgreSQL Security Group | Thử kết nối từ ngoài Internet hoặc Untrust Subnet tới port 5432 | Bị từ chối kết nối (Chỉ cho phép Private Subnet K8s truy cập) | [ ] Pass |
| **INF-DB-03** | Redis (CMC DBaaS) | Ghi & đọc session token qua port 6379 | Phản hồi trong < 2ms, bộ nhớ cache hoạt động ổn định | [ ] Pass |
| **INF-STR-01**| CMC Block Storage (Cinder PV) | Pod Kafka được tạo với StorageClass `highio` | PVC chuyển sang `Bound`, Volume mount thành công tại `/bitnami/kafka/data` | [ ] Pass |
| **INF-STR-02**| CMC S3 Bucket (`hcm-flood-logs`)| Loki đẩy log chunks lên S3 bucket | Bucket ghi nhận các chunks log nén, cấu hình vòng đời retention 30 ngày | [ ] Pass |

---

## 3. LỚP 2: KIỂM THỬ NỀN TẢNG KUBERNETES CKE & BẢO MẬT POD

### 3.1. Kiểm thử phân bổ NodeGroup & Tối ưu tài nguyên (Scheduling & Sizing)

```
Kiểm tra bằng lệnh:
kubectl get pods -A -o wide --show-labels
```

* **Tiêu chuẩn nghiệm thu**:
  1. Toàn bộ Pod hệ thống (`ingress-nginx`, `argocd`, `kyverno`, `loki`, `grafana`) phải nằm 100% trên **System NodeGroup** (`nodegroup=system`).
  2. Toàn bộ Pod ThingsBoard (`tb-node`, `tb-mqtt`, `tb-http`, `tb-web-ui`, `kafka`, `zookeeper`, `js-executor`) phải nằm 100% trên **Workload NodeGroup** (`nodegroup=workload`).
  3. Tất cả các Pod đều có khai báo `requests` và `limits` chi tiết (Không có Pod nào chạy unconstrained memory/cpu).

### 3.2. Kiểm thử NetworkPolicy (Zero-Trust Enforcement)

| Mã TC | Nguồn gửi | Đích đến | Cổng | Hành vi mong đợi | Kết quả |
|---|---|---|---|---|---|
| **K8S-NP-01** | Ingress Controller | `tb-web-ui` | TCP 8080 | **ALLOW** (Thành công) | [ ] Pass |
| **K8S-NP-02** | Ingress Controller | `tb-node` | TCP 8080 | **ALLOW** (Thành công) | [ ] Pass |
| **K8S-NP-03** | `tb-mqtt-transport` | Kafka | TCP 9092 | **ALLOW** (Thành công) | [ ] Pass |
| **K8S-NP-04** | `tb-web-ui` | Kafka | TCP 9092 | **DENY** (Bị chặn hoàn toàn theo NetworkPolicy) | [ ] Pass |
| **K8S-NP-05** | Bất kỳ Pod nào | `kube-system` (ngoài DNS) | Mọi port | **DENY** (Không được phép truy cập cluster internals) | [ ] Pass |
| **K8S-NP-06** | `tb-node` | CMC DBaaS | TCP 5432 | **ALLOW** (Cho phép egress tới subnet DB) | [ ] Pass |

### 3.3. Kiểm thử Kiểm duyệt chính sách Kyverno (Admission Controller)

| Mã TC | Kịch bản cố tình vi phạm | Lệnh thực hiện | Kỳ vọng |
|---|---|---|---|
| **K8S-KYV-01**| Chạy container với user `root` | `kubectl run bad-pod --image=nginx --overrides='{"spec":{"securityContext":{"runAsNonRoot":false}}}'` | **REJECTED** bởi Kyverno Admission Webhook |
| **K8S-KYV-02**| Deploy pod không khai báo resource limit | `kubectl run no-limit --image=alpine` | **REJECTED** với thông báo bắt buộc khai báo cpu/mem limits |
| **K8S-KYV-03**| Mount đĩa hostPath nguy hiểm | Deploy pod với `volumes.hostPath: /` | **REJECTED** do vi phạm chính sách bảo mật máy chủ |

---

## 4. LỚP 3: KIỂM THỬ 6 LUỒNG HOẠT ĐỘNG CHÍNH (END-TO-END FLOW TESTING)

### 🌊 Luồng 1: Thiết bị IoT gửi Telemetry (Mực nước, lượng mưa)
* **Kịch bản**: Giả lập cảm biến ngập trạm Nguyễn Văn Quá (Quận 12) gửi dữ liệu mực nước `water_level = 45 cm` và lượng mưa `rainfall = 65 mm`.
* **Giao thức kiểm thử**:
  1. **MQTT (TCP 1883)**: Dùng công cụ `mosquitto_pub` hoặc `MQTTX` gửi JSON lên topic `v1/devices/me/telemetry` qua Access Token.
  2. **HTTP (TCP 443/8080)**: Dùng `curl` POST JSON lên endpoint `https://thingsboard.web-ui.com/api/v1/{ACCESS_TOKEN}/telemetry`.
* **Chuỗi xác thực**:
  - [x] ILB MQTT / Ingress tiếp nhận gói tin.
  - [x] Transport Pod parse dữ liệu và đẩy vào Kafka topic `tb.transport.api.requests`.
  - [x] `tb-node` consume message từ Kafka, ghi vào PostgreSQL DBaaS bảng `ts_kv`.
  - [x] Redis cập nhật trạng thái thiết bị là `Active/Online`.

### 📊 Luồng 2: Người dân xem Cổng thông tin Ngập lụt thời gian thực (HCM Flood Web Portal)
* **Đối tượng**: Người dân & Cán bộ tra cứu công cộng (Public Access).
* **Kịch bản**: Truy cập trình duyệt `http://flood.web-ui.com` (hoặc `http://flood.dev.web-ui.com`).
* **Chuỗi xác thực**:
  - [x] Giao diện Bản đồ số GIS ngập lụt TP.HCM tải về thành công (React + Vite + Leaflet).
  - [x] TopBar hiển thị đầy đủ các chỉ số: Số điểm an toàn, Cảnh báo, Ngập nguy cấp, Mực nước TB và tổng số trạm online.
  - [x] Biểu đồ Thủy triều 24h (Tide Chart) hiển thị mô phỏng mực nước và cảnh báo giờ đỉnh triều.
  - [x] Sidebar hiển thị danh sách các điểm ngập nghiêm trọng nhất (Severe Locations).
  - [x] Kết nối **WebSocket (`/ws/live`)** duy trì liên tục ở trạng thái `101 Switching Protocols`.
  - [x] Khi trạm IoT gửi telemetry mới ở Luồng 1, bản đồ tự động đổi màu tuyến đường (Xanh ➔ Vàng/Đỏ) và cập nhật số liệu **tức thì qua WebSocket** mà không cần reload trang.

### 🔐 Luồng 3: Quản trị viên & Kỹ sư vận hành truy cập an toàn qua VPN
* **Đối tượng**: Kỹ sư DevOps, Cán bộ quản trị trạm IoT & An ninh mạng.
* **Kịch bản**: Quản trị viên kết nối từ mạng bên ngoài để quản lý cụm qua dải mạng an toàn.
* **Chuỗi xác thực**:
  - [x] Khởi tạo kết nối VPN GlobalProtect tới Firewall Palo Alto (hoặc OpenVPN Bastion).
  - [x] Nhận IP nội bộ an toàn trong dải quản trị.
  - [x] Truy cập được vào các Admin Web UI nội bộ: 
    - **ThingsBoard Admin UI** (`http://thingsboard.web-ui.com`): Quản lý vòng đời thiết bị, cấu hình Device Profile, Access Token, Rule Chain xử lý sự kiện.
    - **ArgoCD / Devtron UI**: Quản trị vòng đời ứng dụng GitOps K8s.
    - **Grafana UI** (`http://grafana.flood.web-ui.com`): Giám sát hạ tầng, logs Loki và metrics Prometheus.
  - [x] Ngắt kết nối VPN ➔ Thử truy cập lại các URL quản trị ➔ Bị chặn hoàn toàn (Bảo vệ tuyệt đối trang quản trị khỏi tấn công Brute-force từ Internet).

### 🚀 Luồng 4: Quy trình GitOps CI/CD tự động
* **Kịch bản**: Kỹ sư sửa đổi một thông số trong Helm values (ví dụ: tăng replica của `tb-web-ui` từ 2 lên 3) và commit lên nhánh `main`.
* **Chuỗi xác thực**:
  - [x] GitHub Actions kích hoạt pipeline kiểm tra syntax (`helm lint`).
  - [x] ArgoCD trên cụm K8s phát hiện thay đổi trên Git repository trong vòng 3 phút.
  - [x] ArgoCD thực hiện `Sync` tự động, số pod của `tb-web-ui` tự động mở rộng lên 3 mà không gây gián đoạn người dùng (Zero Downtime).

### 🚨 Luồng 5: Kích hoạt cảnh báo ngập tự động (Alerting Engine)
* **Kịch bản**: Gửi dữ liệu giả lập mực nước dâng cao `water_level = 85 cm` (vượt ngưỡng Báo động 3: 80 cm).
* **Chuỗi xác thực**:
  - [x] Rule Chain trong `tb-node` so sánh điều kiện ngưỡng ngập.
  - [x] Rule Chain sinh ra một Thực thể Cảnh báo (Alarm Entity) mức `CRITICAL` trong ThingsBoard.
  - [x] Rule Node kích hoạt Webhook gửi thông báo ra ngoài qua Palo Alto Firewall.
  - [x] Bot Telegram của Ban Chỉ huy Phòng chống thiên tai nhận được tin nhắn cảnh báo trong vòng < 2 giây kèm vị trí và mức ngập.

### 📈 Luồng 6: Giám sát tập trung (Observability)
* **Kịch bản**: Kiểm tra việc thu thập chỉ số và nhật ký hệ thống.
* **Chuỗi xác thực**:
  - [x] Grafana hiển thị đầy đủ Dashboard giám sát: CPU/RAM các Node, lưu lượng Ingress Nginx, độ trễ Kafka.
  - [x] Gõ câu truy vấn trên Grafana Explore (Loki): `{app="tb-node"}` ➔ Hiển thị đầy đủ log thời gian thực.
  - [x] Dữ liệu log cũ hơn 1 ngày được xác nhận lưu trữ an toàn trên CMC S3 Bucket.

---

## 5. LỚP 4: KIỂM THỬ HIỆU NĂNG & CHỊU TẢI (STRESS / LOAD TESTING)

### 5.1. Kịch bản 1: Giả lập bão lũ cực đoan (Cảm biến gửi ồ ạt)
* **Công cụ**: `emqtt_bench` hoặc `k6`.
* **Cường độ tải**:
  * 500 trạm cảm biến kết nối đồng thời.
  * Tần suất gửi tin: 1 message / trạm / giây = **500 msgs/sec** duy trì liên tục trong 30 phút.
* **Tiêu chí đạt**:
  * Tỷ lệ gửi thành công: **≥ 99.9%** (Không rớt gói tin MQTT).
  * Kafka Consumer Lag: Không tăng đột biến, tiêu thụ kịp thời dưới 500ms.
  * Tài nguyên Workload Node: CPU < 80%, RAM < 85%.

### 5.2. Kịch bản 2: Người dân truy cập đột biến (Web Dashboard Spike)
* **Công cụ**: `k6` load testing.
* **Cường độ tải**: 1,000 người dùng đồng thời mở trang bản đồ và duy trì kết nối WebSocket.
* **Tiêu chí đạt**:
  * Thời gian phản hồi trang chính (HTTP 200): **< 1.5 giây**.
  * HPA (Horizontal Pod Autoscaler) của `tb-js-executor` tự động kích hoạt: scale từ 2 pods lên 4-6 pods khi CPU chạm ngưỡng 70%.

---

## 6. LỚP 5: KIỂM THỬ KHẢ NĂNG CHỊU LỖI & PHỤC HỒI (HA & FAILOVER TESTING)

| Mã TC | Kịch bản cố tình gây lỗi (Chaos Injection) | Hành vi của hệ thống | Tiêu chuẩn Đạt (SLA) |
|---|---|---|---|
| **CHAOS-01** | Xóa đột ngột Pod `tb-mqtt-transport-0` | Kubernetes Deployment tự động tạo lại Pod mới trong vài giây; ILB định tuyến tạm sang Pod thứ hai | Không mất dữ liệu, gián đoạn < 5s |
| **CHAOS-02** | Xóa Pod Kafka StatefulSet (`iot-thingsboard-kafka-0`) | Pod được tạo lại trong 45s, tự động mount lại chính xác Persistent Volume `highio` cũ (`pvc-ee53db62...`). Bản tin và file kiểm thử còn nguyên 100% | ✅ **ĐẠT (PASS)**<br>- File: `CMC_CLOUD_BLOCK_STORAGE_PERSISTENT_OK`<br>- Message: `CANH_BAO_NGAP_TPHCM_KHONG_BI_MAT_KHI_RESTART` |
| **CHAOS-03** | Rút dây mạng / Tắt 1 Worker Node trong cụm | K8s Control Plane phát hiện Node `NotReady`, tự động evict và schedule lại các Pod sang Worker Node còn lại | Cụm tự phục hồi trong vòng 1-2 phút |
| **CHAOS-04** | Ngắt kết nối mạng của Firewall Active (PA-FW1) | PA-FW2 lập tức chiếm quyền Active | Toàn bộ phiên kết nối duy trì, rớt không quá 1-2 gói tin |

---

## 7. LỚP 6: TIÊU CHÍ NGHIỆM THU LAB CUỐI KHÓA (ACCEPTANCE CHECKLIST)

Bảng đối chiếu phục vụ mục **"10. Mô hình sau triển khai & nghiệm thu"** trong báo cáo LAB:

| TT | Hạng mục nghiệm thu theo đề tài | Yêu cầu kỹ thuật | Trạng thái | Minh chứng đính kèm |
|:--:|---|---|:---:|---|
| **1** | Sử dụng đầy đủ dịch vụ CMC Cloud | VPC, Subnet, VM KKE, DBaaS, Cinder PV, S3 | ✅ ĐẠT | Bảng kê tài nguyên BOM & Sizing |
| **2** | Quy hoạch mạng & IP phân lớp | Phân tách Untrust, Trust, DBaaS rõ ràng | ✅ ĐẠT | Sơ đồ VPC và ma trận IP Subnet |
| **3** | An toàn thông tin & Bảo mật biên | Palo Alto FW HA, lọc L7, chặn quét cổng | ✅ ĐẠT | Log Security Rule & IPS report |
| **4** | Tính sẵn sàng cao (High Availability) | NodeGroup K8s HA, Pod Anti-Affinity, ILB HA | ✅ ĐẠT | Kết quả kiểm thử Chaos Failover |
| **5** | Bảo vệ dữ liệu hàng đợi (No Data Loss) | Kafka có Persistent Volume (`highio` CSI) | ✅ ĐẠT | PVC Status: Bound |
| **6** | Cơ sở dữ liệu chuyên biệt | Dùng CMC DBaaS PostgreSQL + Redis ngoài cụm | ✅ ĐẠT | Cấu hình values trỏ external DBaaS |
| **7** | Vận hành tự động hóa | GitOps triển khai qua ArgoCD | ✅ ĐẠT | Lịch sử commit và sync status |
| **8** | Giám sát & Báo cáo sự cố | Prometheus, Grafana, Loki S3, Telegram Alert | ✅ ĐẠT | Ảnh chụp Dashboard và tin nhắn bot |
| **9** | Đủ 6 luồng vận hành thực tế | IoT, User Web, Admin VPN, GitOps, Alert, Log | ✅ ĐẠT | Video / Screenshot demo nghiệm thu |
