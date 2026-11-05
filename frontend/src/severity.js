// Ngưỡng và màu dùng chung cho bản đồ, danh sách trạm và thanh trên cùng.
export const SEVERITY = {
  SAFE: { color: '#06b6d4', label: '<20cm (An toàn)' },
  ALERT: { color: '#facc15', label: '20–35cm (Cảnh báo)' },
  WARNING: { color: '#ff7b00', label: '35–50cm (Nguy cơ)' },
  CRITICAL: { color: '#ff0055', label: '≥50cm (Ngập sâu)' },
  OFFLINE: { color: '#94a3b8', label: 'Mất tín hiệu' },
};

export const LEVELS = ['SAFE', 'ALERT', 'WARNING', 'CRITICAL'];

export function waterColor(cm) {
  if (cm == null) return '#38bdf8';
  return cm >= 50 ? SEVERITY.CRITICAL.color : cm >= 35 ? SEVERITY.WARNING.color
    : cm >= 20 ? SEVERITY.ALERT.color : '#38bdf8';
}
