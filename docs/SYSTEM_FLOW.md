# Luồng Hoạt Động Hệ Thống — Cảnh Báo Ngập TP.HCM

> **Nền tảng**: ThingsBoard CE 3.4.0 trên CMC Cloud Kubernetes (CKE)  
> **Phiên bản tài liệu**: 1.0 — 2026-10-15

---

## 1. Tổng Quan Kiến Trúc Mạng

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    VPC: vpc-lab (10.0.0.0/16) — Region HCM                 │
│                                                                            │
│  subnet-public / Untrust (10.0.1.0/24)                                    │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │         Palo Alto Firewall — High Availability          │               │
│  │   PA-FW1 (Active)          PA-FW2 (Passive/Failover)   │               │
│  │   Lọc L7, IPS, Anti-DDoS, URL Filtering, DLP           │               │
│  └────────────────────────┬────────────────────────────────┘               │
│                           │ Traffic đã lọc sạch                            │
│  subnet-private / Trust (10.0.2.0/24)                                      │
│  ┌────────────────────────▼────────────────────────────────┐               │
│  │  ILB Ingress (10.0.2.192)    ILB MQTT (10.0.2.193)     │               │
│  │  [HTTP/HTTPS/WebSocket]      [MQTT TCP 1883 — riêng]    │               │
│  │          │                              │                │               │
│  │          ▼                              ▼                │               │
│  │   ┌──────────────────────────────────────────────┐      │               │
│  │   │            Kubernetes Cluster                │      │               │
│  │   │                                              │      │               │
│  │   │  System NodeGroup (2 nodes, 4vCPU/8GB)      │      │               │
│  │   │  ├── NGINX Ingress Controller                │      │               │
│  │   │  ├── ArgoCD / Devtron (GitOps Engine)        │      │               │
│  │   │  ├── Kyverno (Admission Policy)              │      │               │
│  │   │  └── Loki + Promtail + Grafana               │      │               │
│  │   │                                              │      │               │
│  │   │  Workload NodeGroup (2 nodes, 4vCPU/8GB)    │      │               │
│  │   │  ├── TB Node (Core + Rule Engine) x1         │      │               │
│  │   │  ├── TB MQTT Transport x2                    │      │               │
│  │   │  ├── TB HTTP Transport x2                    │      │               │
│  │   │  ├── TB CoAP Transport x1                    │      │               │
│  │   │  ├── TB Web UI x2                            │      │               │
│  │   │  ├── TB JS Executor x2~6 (HPA)               │      │               │
│  │   │  └── Apache Kafka + Zookeeper                │      │               │
│  │   └──────────────────────────────────────────────┘      │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                            │
│  subnet-db / DBaaS (10.0.3.0/24)                                          │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │  PostgreSQL (CMC DBaaS)          Redis (CMC DBaaS)      │               │
│  │  Lưu: devices, telemetry,        Cache: session,        │               │
│  │  alarms, dashboards, users       auth token, state      │               │
│  └─────────────────────────────────────────────────────────┘               │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Luồng 1 — Thiết Bị IoT Gửi Dữ Liệu

**Mô tả**: Các trạm cảm biến đo mực nước, lượng mưa tại TP.HCM gửi telemetry liên tục 24/7.

```
Trạm Cảm Biến IoT
(mực nước, lượng mưa)
        │
        ├─── MQTT (TCP 1883) ─────► PA-FW ──► ILB MQTT (10.0.2.193)
        │                                              │
        ├─── HTTP/REST (TCP 443) ─► PA-FW ──► ILB Ingress ──► Nginx
        │                                                          │
        └─── CoAP (UDP) ──────────────────────► (nội bộ cluster) ─┘
                                                                   │
                                      ┌────────────────────────────┘
                                      │
                             MQTT/HTTP/CoAP Transport
                             (xác thực Device Token)
                                      │ query token
                                      ▼
                               Redis (CMC DBaaS)
                               [Cache auth < 1ms]
                                      │
                               ✅ Hợp lệ
                                      │
                                      ▼
                               Kafka (Port 9092)
                               [Buffer hàng đợi]
                               topic: tb_transport_api
                                      │
                                      ▼ consume
                               TB Node (Rule Engine)
                                      │
                     ┌────────────────┴────────────────┐
                     │                                 │
                     ▼                                 ▼
             JS Executor (2-6)             Đánh giá ngưỡng ngập:
             [Script tính tốc độ          < 35cm  → normal
              nước dâng, dự báo]          35-50cm → warning ⚠️
                     │                    ≥ 50cm  → critical 🚨
                     └────────────┬────────────────────┘
                                  │
                    ┌─────────────┴──────────────────┐
                    ▼                                ▼
             PostgreSQL (CMC DBaaS)          PA-FW → Internet
             Lưu: telemetry, alarm           Telegram / SMS / Email
```

**Thứ tự xử lý:**

| Bước | Thành phần | Hành động |
|------|-----------|-----------|
| 1 | Cảm biến | Gửi JSON `{"water_level_cm": 45, "rainfall_mm": 12, "status": "warning"}` |
| 2 | PA-FW | Kiểm tra Application-ID MQTT, chặn DDoS/Flood |
| 3 | ILB | Phân phối tải vào Transport pods |
| 4 | Transport | Bóc tách Device Token |
| 5 | Redis | Xác thực token < 1ms |
| 6 | Kafka | Đệm message vào topic `tb_transport_api` |
| 7 | TB Node | Consume, chạy Rule Chain |
| 8 | JS Executor | Tính toán nâng cao (nếu Rule Chain có script JS) |
| 9 | TB Node | Đánh giá ngưỡng → phát Alarm nếu cần |
| 10 | PostgreSQL | Ghi telemetry + alarm |
| 11 | PA-FW → Internet | Bắn cảnh báo qua Telegram API / SMS Gateway |

---

## 3. Luồng 2 — Người Dân Xem Bản Đồ Ngập (Public Web Portal)

**Mô tả**: Người dân và cán bộ chỉ huy tra cứu bản đồ ngập lụt TP.HCM thời gian thực (GIS Leaflet & WebSocket).

```
Người dân / Trình duyệt Mobile & PC
(http://flood.web-ui.com)
         │ HTTP/HTTPS (TCP 80/443)
         ▼
PA-FW (Kiểm tra App-ID, chống tấn công L7 Web)
         │
         ▼
ILB Ingress (10.0.2.192)
         │
         ▼
Nginx Ingress Controller
(host: flood.web-ui.com)
         │
         ▼
HCM Flood Frontend Pod (React + Vite + Leaflet)
         │ WebSocket (/ws/live) & REST API
         ▼
HCM Flood Backend Pod (FastAPI)
         │
         ▼
ThingsBoard Node (tb-node)
    │           │
    ▼           ▼
 Redis       PostgreSQL
 [Session]   [Telemetry, alarm, status]

Kết quả hiển thị real-time (không tải lại trang):
  ● Tuyến đường đổi màu (Xanh: An toàn | Vàng: Cảnh báo | Đỏ: Ngập sâu)
  ● Biểu đồ thủy triều 24h & dự báo giờ đỉnh triều
  ● Bảng xếp hạng các điểm ngập nặng nhất toàn thành phố
```

---

## 4. Luồng 3 — Admin & Kỹ Sư Quản Trị Hệ Thống (Secure VPN)

**Mô tả**: Kỹ sư vận hành quản lý cluster, cấu hình thiết bị IoT, deployment và monitoring qua VPN bảo mật.

```
Admin / Kỹ sư vận hành
         │ VPN GlobalProtect / OpenVPN
         ▼
Mạng quản trị an toàn (Subnet Private)
         │
         ├──► ThingsBoard Admin UI (http://thingsboard.web-ui.com)
         │    [Quản lý Device Profile, Access Token, Rule Chains]
         │
         ├──► Devtron & ArgoCD UI (https://argocd.internal)
         │    [Quản trị vòng đời K8s, GitOps CI/CD auto-sync]
         │
         └──► Grafana Monitoring (http://grafana.flood.web-ui.com)
              [Giám sát CPU/RAM, Kafka lag, truy vấn logs Loki]
```

---

## 5. Luồng 4 — Developer CI/CD (GitOps)

**Mô tả**: Quy trình triển khai tự động từ code push đến production, không rebuild.

```
Developer
    │ git push → branch: dev
    │ (frontend/** hoặc backend/**)
    ▼
GitHub Actions (CI)
  ① Build Docker image từ source dev
  ② Push → ghcr.io/tranduyloc895/<app>:<git-SHA>
     digest: sha256:<immutable-hash>
  ③ Cập nhật environments/dev/values.yaml trên main:
     image.tag    = <git-SHA>
     image.digest = sha256:<hash>
  ④ Tạo PR "Promote to prod" (chỉ đổi values prod)
    │
    ├────── values DEV cập nhật ──► ArgoCD auto-sync DEV
    │                                → Deploy iot-dev namespace
    │
    └────── PR chờ review
               │
         👤 Team review:
         - Verify digest khớp với DEV
         - Smoke test WebSocket/telemetry
         - Ghi kết quả vào PR
               │ ✅ Merge PR
               ▼
         values PROD cập nhật trên main
               │
               ▼
         ArgoCD auto-sync PROD
         → Deploy iot-prod namespace
```

**Nguyên tắc:**

| Nguyên tắc | Mô tả |
|-----------|--------|
| **Build 1 lần** | Image build từ `dev`, promote nguyên digest lên prod |
| **Immutable image** | Mỗi PR gắn với 1 digest cố định, build mới không ghi đè PR cũ |
| **GitOps** | Trạng thái cluster = nội dung `values.yaml` trên branch `main` |
| **Tách Source ↔ Config** | Code trên `dev`, deployment config trên `main` |
| **Kiểm duyệt thủ công** | Không auto-merge PR promotion lên prod |

---

## 6. Luồng Nội Bộ — Rule Engine & Cảnh Báo

```
Kafka (tb_transport_api)
         │ consume
         ▼
TB Node — Rule Chain
         │
         ├── Kiểm tra ngưỡng mực nước
         │     < 35cm  → normal (lưu, không alarm)
         │     35-50cm → warning → tạo Alarm
         │     ≥ 50cm  → critical → tạo Alarm KHẨN
         │
         ├── JS Script (tính tốc độ nước dâng)
         │    └── Kafka topic: tb_js_eval
         │           └── JS Executor (2-6 replicas, HPA)
         │                  └── Trả kết quả về TB Node
         │
         ├── Lưu vào PostgreSQL
         │     ● ts_kv: time-series telemetry
         │     ● alarm: cảnh báo với severity
         │     ● attribute_kv: trạng thái thiết bị
         │
         └── Phát cảnh báo (khi critical)
               └── REST Webhook → PA-FW (URL Filter)
                   ● Telegram Bot API
                   ● SMS Gateway
                   ● Email SMTP
```

---

## 7. Luồng Logging & Monitoring

```
Tất cả Pods trong cluster (stdout / stderr)
         │
         ▼ /var/log/pods/ trên Worker Nodes
Promtail DaemonSet (1 pod/node)
  Gắn nhãn: namespace, pod, container, node, app
         │ HTTP push
         ▼
Loki (Port 3100) — System NodeGroup
  ├── Index cache: /var/loki/tsdb-index (local tạm)
  └── Chunks: CMC S3 "hcm-flood-logs" (30 ngày)
         │ query LogQL
         ▼
Grafana (grafana.flood.web-ui.com)
  ├── Datasource Loki     → tra cứu log pod/container
  └── Datasource Prometheus (cmc-monitoring) → metrics
```

---

## 8. Ma Trận Firewall & Định Tuyến

| Hướng | Nguồn | Đích | Cổng | Mục đích |
|-------|-------|------|------|---------|
| INBOUND | Internet | PA-FW Untrust | TCP 1883 | Cảm biến gửi MQTT |
| INBOUND | Internet | PA-FW Untrust | TCP 80/443 | Người dùng xem Web UI |
| INBOUND | Trust Subnet | K8s Ingress | TCP 8080/8081 | ILB chuyển traffic sạch |
| EAST-WEST | MQTT Transport | Redis DBaaS | TCP 6379 | Xác thực token thiết bị |
| EAST-WEST | Transport pods | Kafka | TCP 9092 | Đưa message vào queue |
| EAST-WEST | TB Node | PostgreSQL DBaaS | TCP 5432 | Đọc/ghi telemetry & alarm |
| EAST-WEST | TB Web UI | TB Node | TCP 8080 | WebSocket / REST API |
| EAST-WEST | Promtail | Loki | TCP 3100 | Push log |
| OUTBOUND | TB Node | Telegram / SMS GW | TCP 443 | Phát cảnh báo ngập |
| OUTBOUND | K8s Worker Nodes | Docker Hub / GHCR | TCP 443 | Pull container images |
| OUTBOUND | ArgoCD | GitHub | TCP 443 | GitOps sync repository |

---

## 9. Chiến Lược Lưu Trữ

| Thành phần | Lưu ở đâu | Persistent? | Lý do |
|-----------|-----------|------------|-------|
| **PostgreSQL** | CMC DBaaS (external) | ✅ Vĩnh viễn | Dữ liệu nghiệp vụ cốt lõi |
| **Redis** | CMC DBaaS (external) | ✅ Có backup | Cache state, recovery nhanh |
| **TB Node logs** | emptyDir → Promtail thu | ⚠️ Tạm | Promtail đẩy lên Loki S3 |
| **Loki chunks** | CMC S3 `hcm-flood-logs` | ✅ 30 ngày | Object storage bền vững |
| **Kafka messages** | CMC Cinder PV `highio` (10Gi) | ✅ Bền vững | Hàng đợi tin nhắn Zero-Message-Loss |
| **Zookeeper metadata** | CMC Cinder PV `highio` (5Gi) | ✅ Bền vững | Metadata cụm Kafka & đồng bộ phân tán |

> **Triết lý**: Hạ tầng ứng dụng linh hoạt, dữ liệu quan trọng luôn được bảo vệ bền vững tại CMC DBaaS, S3 & Block Storage Cinder.
