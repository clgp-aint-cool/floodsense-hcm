# Cẩm Nang Kiểm Thử Từng Bước Toàn Bộ Hệ Thống (Step-by-Step Testing Guide)

> **Mục tiêu**: Hướng dẫn thao tác lệnh (CLI), kịch bản và xác thực kết quả thực tế trên hạ tầng **CMC Cloud** cho 6 lớp kiểm thử.  
> **Môi trường thực hiện**: Máy chủ **Bastion (`ecs-bastion`)** kết nối cụm K8s CKE hoặc máy trạm Admin có cấu hình `kubectl`.

---

## 🧭 BẢN ĐỒ KIỂM THỬ HỆ THỐNG

```
[Máy Bastion / Admin Terminal]
  ├── LỚP 1: Hạ tầng CMC Cloud (VPC, Subnet, Palo Alto FW, ILB, DBaaS, Storage)
  ├── LỚP 2: Cụm K8s CKE (NodeGroups, NetworkPolicy, Kyverno, Resource Quotas)
  ├── LỚP 3: Kiểm thử 6 Luồng E2E (IoT Telemetry, Web UI, VPN, GitOps, Alert, Logs)
  ├── LỚP 4: Kiểm thử Hiệu năng & Chịu tải (MQTT Stress Test, HPA Autoscaling)
  ├── LỚP 5: Kiểm thử Khả năng Phục hồi (Pod Failure, PV Re-mount, Node Drain, FW Failover)
  └── LỚP 6: Thu thập Minh chứng Nghiệm thu (Screenshots, Logs Export cho Báo cáo LAB)
```

---

# LỚP 1: KIỂM THỬ HẠ TẦNG CLOUD & MẠNG (INFRASTRUCTURE TESTING)

### Bước 1.1: Kiểm tra phân hoạch Subnet & Cô lập mạng
Thao tác trên terminal máy chủ **Bastion**:

```bash
# 1. Kiểm tra kết nối tới các Subnet nội bộ
ping -c 3 10.0.2.192   # ILB Ingress trong Trust Subnet
ping -c 3 10.0.2.193   # ILB MQTT trong Trust Subnet

# 2. Kiểm tra routing đi qua Firewall Palo Alto
traceroute -n 8.8.8.8
```
* **Kỳ vọng**: 
  - Ping nội bộ tới các IP `10.0.2.x` thành công (độ trễ < 1ms).
  - Hop đầu tiên của `traceroute` bắt buộc phải là IP Interface Trust của Palo Alto Firewall (`10.0.2.1` hoặc gateway cấu hình).

### Bước 1.2: Kiểm tra an ninh biên & Quét cổng Tường lửa Palo Alto
Thao tác từ máy tính cá nhân ở ngoài Internet (không kết nối VPN):

```bash
# Thay <PUBLIC_IP_FIREWALL> bằng IP Public của cụm Palo Alto trên CMC Cloud
nmap -Pn -p 80,443,1883,5432,6379,22,9092 <PUBLIC_IP_FIREWALL>
```
* **Kỳ vọng**:
  - `80/tcp`: **OPEN** (HTTP chuyển hướng HTTPS)
  - `443/tcp`: **OPEN** (HTTPS Web UI & Ingress API)
  - `1883/tcp`: **OPEN** (MQTT Port cho cảm biến)
  - `5432, 6379, 9092, 22`: **FILTERED / CLOSED** (Tuyệt đối không lộ cổng Database, Redis, Kafka, SSH ra ngoài Internet).

### Bước 1.3: Kiểm tra 2 bộ Cân bằng tải nội bộ (ILB)
Thao tác từ máy Bastion:

```bash
# 1. Kiểm tra ILB Ingress (Port 80/443)
curl -k -I https://10.0.2.192 -H "Host: thingsboard.web-ui.com"

# 2. Kiểm tra ILB MQTT (Port 1883)
nc -zvw3 10.0.2.193 1883
```
* **Kỳ vọng**:
  - Lệnh `curl` trả về header `HTTP/1.1 200 OK` hoặc `302/308` từ NGINX Ingress Controller.
  - Lệnh `nc` báo `Connection to 10.0.2.193 1883 port [tcp] succeeded!`.

### Bước 1.4: Kiểm tra kết nối CMC DBaaS & Tính cô lập
Thao tác từ máy Bastion:

```bash
# Thay 10.0.3.x bằng IP của PostgreSQL và Redis DBaaS
# 1. Kiểm tra cổng PostgreSQL
nc -zvw3 10.0.3.10 5432

# 2. Kiểm tra cổng Redis
nc -zvw3 10.0.3.11 6379
```
* **Kỳ vọng**: Kết nối thành công từ mạng nội bộ `10.0.0.0/16`.

### Bước 1.5: Kiểm tra Persistent Volume Cinder (`highio`) & CMC S3
```bash
# 1. Kiểm tra StorageClass
kubectl get sc highio

# 2. Kiểm tra PVC của Kafka & Zookeeper đã Bound
kubectl get pvc -n thingsboard
```
* **Kỳ vọng**: Cột `STATUS` của `data-thingsboard-kafka-0` và `data-thingsboard-zookeeper-0` là **`Bound`**, StorageClass là **`highio`**.

---

# LỚP 2: KIỂM THỬ CỤM KUBERNETES CKE & BẢO MẬT CONTAINER

### Bước 2.1: Kiểm tra quy hoạch phân bổ NodeGroup
```bash
# Kiểm tra NodeGroup của các Node
kubectl get nodes -L nodegroup

# Kiểm tra Pod hệ thống chạy đúng trên System NodeGroup
kubectl get pods -n ingress-nginx -o wide
kubectl get pods -n argocd -o wide
kubectl get pods -n kyverno -o wide

# Kiểm tra Pod ThingsBoard chạy đúng trên Workload NodeGroup
kubectl get pods -n thingsboard -o wide
```
* **Kỳ vọng**:
  - Pod của Ingress, ArgoCD, Kyverno, Loki đều nằm trên các node có label `nodegroup=system`.
  - Toàn bộ Pod `tb-*`, `kafka-*` đều nằm trên các node có label `nodegroup=workload`.

### Bước 2.2: Kiểm tra Quota tài nguyên (Requests / Limits)
```bash
kubectl get pods -n thingsboard -o custom-columns=\
NAME:.metadata.name,\
CPU_REQ:.spec.containers[*].resources.requests.cpu,\
MEM_REQ:.spec.containers[*].resources.requests.memory,\
CPU_LIM:.spec.containers[*].resources.limits.cpu,\
MEM_LIM:.spec.containers[*].resources.limits.memory
```
* **Kỳ vọng**: Không có trường nào bị `<none>`, mọi container đều có giới hạn rõ ràng.

### Bước 2.3: Kiểm thử thực tế NetworkPolicy (Zero-Trust)
Thử nghiệm kết nối hợp lệ và bất hợp pháp bằng pod kiểm thử tạm:

```bash
# 1. Test kết nối HỢP LỆ: Từ Pod transport sang Kafka port 9092
kubectl exec -it -n thingsboard deployment/thingsboard-tb-mqtt-transport -- nc -zvw2 thingsboard-kafka 9092
# 👉 Kỳ vọng: Succeeded!

# 2. Test kết nối BỊ CHẶN: Tạo 1 pod lạ trong namespace default và cố kết nối vào Kafka
kubectl run test-hacker --image=busybox -it --rm --restart=Never -- nc -zvw2 thingsboard-kafka.thingsboard.svc.cluster.local 9092
# 👉 Kỳ vọng: Timeout / Connection Refused (Bị NetworkPolicy chặn 100%).
```

### Bước 2.4: Kiểm thử Admission Controller Kyverno
Thử cố tình tạo 1 Pod chạy dưới quyền `root` để kiểm tra Kyverno:

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: test-root-violation
  namespace: default
spec:
  containers:
  - name: root-container
    image: alpine
    command: ["sleep", "3600"]
    securityContext:
      runAsNonRoot: false
      runAsUser: 0
EOF
```
* **Kỳ vọng**: Lệnh bị Kubernetes từ chối ngay lập tức:
  `Error from server: admission webhook "validate.kyverno.svc" denied the request: container root-container is running as root!`

---

# LỚP 3: KIỂM THỬ 6 LUỒNG NGHIỆP VỤ (END-TO-END)

### Bước 3.1: Luồng 1 — Cảm biến IoT gửi Telemetry
Sử dụng cURL hoặc lệnh `mosquitto_pub` để gửi dữ liệu mực nước giả lập:

```bash
# Giả sử ACCESS_TOKEN của thiết bị trạm Nguyễn Văn Quá là "STATION_NVQ_001"
# 1. Gửi qua giao thức MQTT (Port 1883)
mosquitto_pub -h 10.0.2.193 -p 1883 \
  -u "STATION_NVQ_001" \
  -t "v1/devices/me/telemetry" \
  -m '{"water_level": 45.5, "rainfall": 60.2, "voltage": 12.4}'

# 2. Gửi qua giao thức HTTP REST API (Port 80/443)
curl -k -X POST "https://10.0.2.192/api/v1/STATION_NVQ_001/telemetry" \
  -H "Host: thingsboard.web-ui.com" \
  -H "Content-Type: application/json" \
  -d '{"water_level": 48.0, "rainfall": 70.0}'
```
* **Kỳ vọng**: 
  - Mã trả về `200 OK`.
  - Log của pod `tb-node` ghi nhận: `Processing telemetry for device STATION_NVQ_001`.

### Bước 3.2: Luồng 2 — Người dân xem Cổng thông tin Ngập lụt (Web Flood Portal) & WebSocket Real-time
1. Trên máy trạm, mở trình duyệt truy cập: `http://flood.web-ui.com` (hoặc `http://flood.dev.web-ui.com`).
2. Quan sát giao diện Cổng thông tin Ngập lụt TP.HCM:
   - **Bản đồ số GIS (Leaflet)**: Hiển thị mạng lưới trạm quan trắc và các tuyến đường trọng điểm (Nguyễn Văn Quá, Phan Huy Ích, Huỳnh Tấn Phát, Thảo Điền...).
   - **TopBar**: Thống kê số trạm an toàn, cảnh báo, nguy cấp và tổng số trạm online.
   - **Sidebar**: Biểu đồ thủy triều 24h và danh sách các điểm ngập nặng nhất.
3. Bấm **F12** (Developer Tools) ➔ Tab **Network** ➔ Lọc **WS**:
   - Xác nhận kết nối WebSocket `/ws/live` đang mở ở trạng thái `101 Switching Protocols`.
4. Trên máy `simulator`, gửi bản tin telemetry mực nước dâng cao:
   ```bash
   mosquitto_pub -h 10.0.1.200 -p 1883 -u "DZVX54HKFE84cHWzcRfF" \
     -t "v1/devices/me/telemetry" \
     -m '{"water_level": 85.5}'
   ```
* **Kỳ vọng**: Tuyến đường tương ứng trên bản đồ Web Flood lập tức đổi màu (Xanh ➔ Đỏ) và số đo mực nước trên widget cập nhật ngay tức thì qua WebSocket mà không cần reload trang.

### Bước 3.3: Luồng 3 — Quản trị viên truy cập an toàn qua VPN
1. Bật phần mềm **GlobalProtect** hoặc **OpenVPN** để kết nối vào dải quản trị.
2. Mở trình duyệt truy cập các dịch vụ quản trị nội bộ:
   - **ThingsBoard Admin UI**: `http://thingsboard.web-ui.com` (Đăng nhập tài khoản điều hành quản lý thiết bị & Rule Chain).
   - **ArgoCD**: `https://argocd.internal` (Quản trị trạng thái đồng bộ ứng dụng K8s).
   - **Grafana**: `http://grafana.flood.web-ui.com` (hoặc `http://10.0.2.x:3000` - Giám sát metrics & logs Loki).
3. Ngắt kết nối VPN và thử F5 lại các trang quản trị:
* **Kỳ vọng**: Khi bật VPN thì truy cập mượt mà; khi tắt VPN thì toàn bộ kết nối bị từ chối / timeout (Bảo vệ tuyệt đối các trang quản trị khỏi tấn công từ Internet).

### Bước 3.4: Luồng 4 — Kiểm thử GitOps CI/CD tự động
1. Trên máy tính phát triển, sửa 1 giá trị nhỏ trong file `values.yaml` (ví dụ: chú thích hoặc chỉnh nhẹ replica).
2. Push lên nhánh `main`:
   ```bash
   git add .
   git commit -m "test(gitops): verify argocd auto synchronization"
   git push origin main
   ```
3. Mở giao diện ArgoCD:
* **Kỳ vọng**: ArgoCD chuyển trạng thái `OutOfSync` ➔ `Processing` ➔ `Synced` & `Healthy` tự động.

### Bước 3.5: Luồng 5 — Kích hoạt Cảnh báo ngập tự động (Telegram Alert)
Gửi dữ liệu giả lập mực nước dâng cao nguy cấp:

```bash
curl -k -X POST "https://10.0.2.192/api/v1/STATION_NVQ_001/telemetry" \
  -H "Host: thingsboard.web-ui.com" \
  -H "Content-Type: application/json" \
  -d '{"water_level": 95.0, "status": "DANGER"}'
```
* **Kỳ vọng**: 
  - `tb-node` Rule Engine khớp điều kiện `water_level > 80`.
  - Tạo Alarm `CRITICAL` trên ThingsBoard.
  - Sau 1 - 2 giây, điện thoại nhận được tin nhắn từ Bot Telegram:  
    `⚠️ CẢNH BÁO NGẬP: Trạm Nguyễn Văn Quá mực nước đạt 95cm! Vượt ngưỡng Báo động 3!`.

### Bước 3.6: Luồng 6 — Kiểm tra Giám sát Logs & Metrics
```bash
# Kiểm tra xem Promtail có đang gom log gửi về Loki không
kubectl logs -l app.kubernetes.io/name=promtail -n monitoring --tail=20

# Đăng nhập Grafana -> Vào mục Explore -> Chọn datasource Loki
# Nhập câu query:
{namespace="thingsboard"} |= "telemetry"
```
* **Kỳ vọng**: Grafana hiển thị đầy đủ các dòng log thực tế được index theo từng mili-giây.

---

# LỚP 4: KIỂM THỬ HIỆU NĂNG & CHỊU TẢI (STRESS TESTING)

### Bước 4.1: Kiểm thử tải dồn dập thiết bị IoT (MQTT Ingestion Load)
Tạo một script bash ngắn để giả lập 500 bản tin gửi liên tiếp trong 10 giây:

```bash
for i in $(seq 1 500); do
  mosquitto_pub -h 10.0.2.193 -p 1883 -u "STATION_NVQ_001" \
    -t "v1/devices/me/telemetry" \
    -m "{\"water_level\": $((RANDOM % 100)), \"seq\": $i}" &
done
wait
echo "Hoàn thành gửi 500 requests đồng thời!"
```

* **Kiểm tra độ trễ Kafka**:
  ```bash
  # Kiểm tra Kafka không bị nghẽn
  kubectl exec -it -n thingsboard thingsboard-kafka-0 -- \
    kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group thingsboard-node
  ```
* **Kỳ vọng**: Cột `LAG` của consumer group xấp xỉ `0` hoặc tiêu thụ hết sau < 3 giây.

### Bước 4.2: Kiểm tra tự động co giãn Horizontal Pod Autoscaler (HPA)
Quan sát pod `tb-js-executor`:

```bash
kubectl get hpa -n thingsboard -w
```
* **Kỳ vọng**: Khi tải tính toán tăng cao, số lượng pod `tb-js-executor` tự động scale từ `2` lên `4` hoặc `6` replicas; khi tải giảm, pod tự scale down về `2`.

---

# LỚP 5: KIỂM THỬ KHẢ NĂNG PHỤC HỒI THẢM HỌA (CHAOS & HA TESTING)

### Bước 5.1: Xóa đột ngột Pod Transport
```bash
# Xóa 1 pod mqtt transport
kubectl delete pod thingsboard-tb-mqtt-transport-xxx -n thingsboard
# Lập tức gửi tin MQTT
mosquitto_pub -h 10.0.2.193 -p 1883 -u "STATION_NVQ_001" -t "v1/devices/me/telemetry" -m '{"test": "ha"}'
```
* **Kỳ vọng**: ILB MQTT lập tức định tuyến sang Pod transport thứ hai; gói tin gửi thành công không gián đoạn; Pod bị xóa được K8s tạo lại ngay lập tức.

### Bước 5.2: Xóa Pod Kafka & Kiểm tra bảo toàn dữ liệu trên PV
```bash
# Xóa pod Kafka StatefulSet
kubectl delete pod thingsboard-kafka-0 -n thingsboard

# Chờ pod khởi động lại và kiểm tra volume mount
kubectl get pod thingsboard-kafka-0 -n thingsboard -w
```
* **Kỳ vọng**: Pod `thingsboard-kafka-0` được gắn lại đúng Volume ID `highio` ban đầu, toàn bộ cấu hình topic và dữ liệu hàng đợi được giữ nguyên vẹn.

### Bước 5.3: Thử nghiệm Drain 1 Worker Node
```bash
# Cô lập và chuyển toàn bộ pod trên 1 node sang node khác
kubectl drain <TÊN_WORKLOAD_NODE_1> --ignore-daemonsets --delete-emptydir-data

# Kiểm tra trạng thái Pods
kubectl get pods -n thingsboard -o wide
```
* **Kỳ vọng**: Toàn bộ ứng dụng ThingsBoard tự động di dời sang Node thứ hai, hệ thống vẫn phản hồi bình thường. Sau khi test xong chạy `kubectl uncordon <TÊN_WORKLOAD_NODE_1>`.

---

# LỚP 6: BÀN GIAO & THU THẬP MINH CHỨNG CHO BÁO CÁO LAB

Chụp lại các ảnh chụp màn hình (Screenshots) sau để dán vào **Mục 10 của Báo cáo LAB**:

1. 📸 **Ảnh 1**: Terminal chạy `kubectl get nodes -o wide` và `kubectl get pods -A` hiển thị toàn bộ pods ở trạng thái `Running`.
2. 📸 **Ảnh 2**: Terminal chạy `kubectl get pvc -n thingsboard` xác nhận Kafka & Zookeeper đang `Bound` với StorageClass `highio`.
3. 📸 **Ảnh 3**: Giao diện Web ThingsBoard hiển thị Dashboard mực nước nhảy số thời gian thực.
4. 📸 **Ảnh 4**: Tin nhắn Bot Telegram cảnh báo ngập tự động khi vượt ngưỡng.
5. 📸 **Ảnh 5**: Giao diện ArgoCD hiển thị trạng thái `Synced` và `Healthy` của toàn bộ ứng dụng.
6. 📸 **Ảnh 6**: Giao diện Grafana hiển thị dashboard giám sát CPU/RAM và log Loki từ S3.
