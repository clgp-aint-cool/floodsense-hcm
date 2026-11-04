---
description: Quy chuẩn thiết kế UI/UX cho ứng dụng Web, đảm bảo giao diện cao cấp, chuyên nghiệp và tránh phong cách "AI-generated" nhàm chán.
---

# UI/UX Design Rules (Anti-Generic / Premium Look)

Khi viết code Frontend (React/Next.js/Vue) hoặc CSS/Tailwind, hãy TUYỆT ĐỐI tuân thủ các quy tắc thiết kế sau để giao diện nhìn đẳng cấp, hiện đại và có "hồn", tránh xa phong cách rập khuôn thường thấy của AI.

## 1. Typography (Nghệ thuật chữ)
- **KHÔNG DÙNG** font mặc định của trình duyệt (Arial, Times New Roman) hay Roboto thông thường.
- **BẮT BUỘC DÙNG** các web font hiện đại từ Google Fonts như: `Inter`, `Plus Jakarta Sans`, `Space Grotesk` (cho số liệu/Dashboard), hoặc `Outfit`.
- **Hệ thống chữ:** Tiêu đề (Headings) cần đậm và rõ nét (font-weight: 700/800). Các con số trên dashboard cần sử dụng font monospace hoặc tabular-nums để thẳng hàng.

## 2. Color Palette (Bảng màu)
- **Tránh xa màu cơ bản nguyên thủy:** Tuyệt đối không dùng đỏ tươi (`#FF0000`), xanh lục (`#00FF00`), hay xanh lam cơ bản.
- **Sử dụng màu sắc tinh tế (Tailwind colors):**
  - Background (Dark Mode): Sử dụng `bg-zinc-950` hoặc `bg-slate-900` kết hợp với radial gradients mờ ảo.
  - Background (Light Mode): Không dùng trắng toát `#FFFFFF`, hãy dùng xám cực nhẹ như `bg-gray-50` hoặc `bg-slate-50`.
  - Màu nhấn (Accent): Sử dụng gradient nhẹ nhàng (vd: `from-emerald-400 to-teal-500` cho trạng thái an toàn, `from-rose-500 to-red-600` cho báo động ngập).
- Bổ sung hiệu ứng **Glassmorphism** (kính mờ): `backdrop-blur-md bg-white/10` cho các panel nổi (floating panels/widgets) trên bản đồ.

## 3. Layout & Spacing (Bố cục và Khoảng trắng)
- Không thiết kế dạng "các hộp xếp liền nhau" khô khan. Hãy dùng khoảng trắng (whitespace) rộng rãi để UI thở.
- Sử dụng góc bo tròn tinh tế: `rounded-xl` hoặc `rounded-2xl`. 
- Thêm viền siêu mảnh cho các card (đặc biệt trong dark mode): `border border-white/5`.
- Đổ bóng (Shadows): Tránh bóng đen gắt. Dùng bóng mềm, sâu: `shadow-xl shadow-black/10` hoặc các box-shadow custom có layer.

## 4. Micro-Interactions & Animations
- Mọi action (hover button, click) đều phải có transition: `transition-all duration-300 ease-in-out`.
- Nút bấm (Buttons): Khi hover nên có hiệu ứng sáng lên nhẹ, hoặc lift lên (dịch lên -2px).
- Dùng thư viện như `Framer Motion` (nếu làm React) để làm hiệu ứng xuất hiện mượt mà cho các widget (fade in + trượt lên nhẹ).

## 5. Map & Data Visualization (Chuẩn theo Mockup Flood Tracker)
Để đạt được thiết kế như bản Mockup "HCM Flood Tracker", khi lập trình cần bắt buộc tuân theo cấu trúc sau:
- **Layout Chính:**
  - Sidebar bên trái: Rộng khoảng `350px - 400px`, nằm đè lên bản đồ (floating over map). Nền sidebar phải dùng **Glassmorphism** cực xịn (vd: `bg-zinc-900/80 backdrop-blur-xl border-r border-white/5`).
  - Bản đồ chiếm toàn bộ màn hình (Full-screen map) chìm bên dưới.
- **Biểu đồ (Tide Charts):**
  - Sử dụng Area Chart (biểu đồ vùng) với đường curve mềm mại (smooth spline).
  - Vùng dưới đường biểu đồ phải được fill bằng **Gradient dọc**: màu xanh/đỏ ở trên cùng, mờ dần về trong suốt (`transparent`) ở dưới đáy.
- **Bản đồ & Markers:**
  - **Base map:** Bắt buộc dùng Mapbox Dark theme (hoặc Carto Dark Matter) với tông màu xám/đen tối màu để làm chìm các đường phố không quan trọng.
  - **Markers (Điểm ngập/Xe IoT):** Tuyệt đối không dùng Icon ghim (pin) có sẵn. Phải dùng CSS/SVG vẽ các điểm sáng (glowing dots):
    - Lõi (Core): Màu nổi rõ `bg-emerald-400`, `bg-amber-400` hoặc `bg-rose-500`.
    - Vòng toả sáng (Glow): Box-shadow lan toả nhiều lớp.
    - Sóng tỏa ra (Pulsating ring): Dùng CSS animation `animate-ping` hoặc keyframe custom để tạo hiệu ứng nháy.
- **Danh sách cảnh báo (Severe Flood Locations):**
  - Trình bày dạng danh sách card (List items) bo góc `rounded-xl`, nền đen mờ `bg-black/20`.
  - Có các badge/tag cảnh báo chữ đỏ nền mờ (`text-rose-500 bg-rose-500/10`) để thu hút sự chú ý.

> **Mục tiêu tối thượng:** Ngay cái nhìn đầu tiên, end-user phải thốt lên "Wow, cái web này nhìn xịn và pro quá!" chứ không phải "Trông giống mấy trang admin template miễn phí".
