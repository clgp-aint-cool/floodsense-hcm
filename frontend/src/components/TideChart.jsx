import React from 'react';

// Mức cảnh báo triều cường TP.HCM (Hệ thống báo động lũ sông Sài Gòn - Đồng Nai)
function getTideAlert(level) {
  if (level >= 1.7) return { label: 'BĐ III + Xả lũ', color: '#ff0055', bg: 'rgba(255,0,85,0.18)', icon: '🚨' };
  if (level >= 1.5) return { label: 'Báo động III', color: '#f43f5e', bg: 'rgba(244,63,94,0.16)', icon: '⚠️' };
  if (level >= 1.35) return { label: 'Báo động II', color: '#fb923c', bg: 'rgba(251,146,60,0.15)', icon: '⚠️' };
  if (level >= 1.1) return { label: 'Báo động I', color: '#facc15', bg: 'rgba(250,204,21,0.14)', icon: '📢' };
  return { label: 'Bình thường', color: '#10b981', bg: 'rgba(16,185,129,0.13)', icon: '✅' };
}

// Suy luận nguyên nhân ngập dựa trên mực triều + mưa (optional)
function getFloodCause(level, rainfall_mm) {
  const highTide = level >= 1.35;
  const heavyRain = rainfall_mm != null && rainfall_mm >= 25;
  if (highTide && heavyRain) return { cause: 'Triều cường + Mưa lớn cộng hưởng', color: '#f43f5e', icon: '⛈️' };
  if (highTide) return { cause: 'Ngập do triều cường dâng cao', color: '#fb923c', icon: '🌊' };
  if (heavyRain) return { cause: 'Ngập do mưa lớn cục bộ', color: '#38bdf8', icon: '🌧️' };
  return null;
}

export default function TideChart({ station, rainfall_mm }) {
  if (!station || !station.hourly_data) return null;

  const data = station.hourly_data;
  const maxLevel = Math.max(...data.map(d => d.level), 2.0);
  const minLevel = 0.0;

  // Kích thước SVG
  const width = 320;
  const height = 105;
  const paddingX = 28;
  const paddingY = 14;

  const getX = (hour) => paddingX + (hour / 24) * (width - 2 * paddingX);
  const getY = (level) => height - paddingY - ((level - minLevel) / (maxLevel - minLevel)) * (height - 2 * paddingY);

  // Smooth Bezier Spline
  let pathD = `M ${getX(data[0].hour)} ${getY(data[0].level)}`;
  for (let i = 0; i < data.length - 1; i++) {
    const x0 = getX(data[i].hour);
    const y0 = getY(data[i].level);
    const x1 = getX(data[i + 1].hour);
    const y1 = getY(data[i + 1].level);
    const cpX1 = x0 + (x1 - x0) / 2;
    const cpX2 = x1 - (x1 - x0) / 2;
    pathD += ` C ${cpX1} ${y0}, ${cpX2} ${y1}, ${x1} ${y1}`;
  }

  const areaD = `${pathD} L ${getX(data[data.length - 1].hour)} ${height - paddingY} L ${getX(data[0].hour)} ${height - paddingY} Z`;

  const peakHour = station.peak_hour ?? 11;
  const peakLevel = station.peak_level ?? 1.5;
  const peakX = getX(peakHour);
  const peakY = getY(peakLevel);

  const alert = getTideAlert(station.current_level);
  const cause = getFloodCause(station.current_level, rainfall_mm);
  const gradId = `tide-grad-${station.station_id}`;
  const lineColor = alert.color;

  // Vẽ đường chuẩn BĐ II (1.35m) và BĐ III (1.5m)
  const bdIIY = getY(1.35);
  const bdIIIY = getY(1.5);

  return (
    <div style={{
      background: 'rgba(14, 18, 28, 0.78)',
      borderRadius: '16px',
      padding: '12px 14px',
      border: `1px solid ${alert.color}25`,
      marginBottom: '10px',
    }}>
      {/* ── Tên trạm + cấp báo động ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>📍</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>
              {station.name}
            </span>
          </div>
          {/* Nguyên nhân ngập */}
          {cause && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '9.5px', fontWeight: 600, color: cause.color,
              background: `${cause.color}18`,
              border: `1px solid ${cause.color}30`,
              borderRadius: '5px',
              padding: '1px 6px',
              width: 'fit-content',
              marginTop: '2px'
            }}>
              <span>{cause.icon}</span>
              <span>{cause.cause}</span>
            </div>
          )}
        </div>

        {/* Badge cấp báo động */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px',
          flexShrink: 0, marginLeft: '8px'
        }}>
          <span style={{
            fontSize: '10px', fontWeight: 700,
            padding: '2px 7px', borderRadius: '6px',
            background: alert.bg, color: alert.color,
            border: `1px solid ${alert.color}40`,
            whiteSpace: 'nowrap'
          }}>
            {alert.icon} {alert.label}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <span style={{
              fontSize: '15px', fontWeight: 800,
              color: alert.color, fontFamily: 'Space Grotesk', lineHeight: 1
            }}>
              {station.current_level.toFixed(2)}m
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {station.trend === 'UP' ? '↑' : '↓'}
            </span>
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>
            Đỉnh {station.peak_level?.toFixed(2)}m lúc {station.peak_hour}h
          </div>
        </div>
      </div>

      {/* ── SVG Chart ── */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.5" />
              <stop offset="60%" stopColor={lineColor} stopOpacity="0.12" />
              <stop offset="100%" stopColor="#090a0f" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Đường BĐ III (1.5m) - đỏ */}
          <line x1={paddingX} y1={bdIIIY} x2={width - paddingX} y2={bdIIIY}
            stroke="rgba(244,63,94,0.45)" strokeDasharray="4 3" strokeWidth="1" />
          <text x={paddingX + 2} y={bdIIIY - 3} fill="rgba(244,63,94,0.7)" fontSize="8" fontFamily="Space Grotesk" fontWeight="700">
            BĐ III 1.5m
          </text>

          {/* Đường BĐ II (1.35m) - cam */}
          <line x1={paddingX} y1={bdIIY} x2={width - paddingX} y2={bdIIY}
            stroke="rgba(251,146,60,0.4)" strokeDasharray="4 3" strokeWidth="1" />
          <text x={paddingX + 2} y={bdIIY - 3} fill="rgba(251,146,60,0.7)" fontSize="8" fontFamily="Space Grotesk" fontWeight="700">
            BĐ II 1.35m
          </text>

          {/* Area fill */}
          <path d={areaD} fill={`url(#${gradId})`} />

          {/* Đường cong chính */}
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" />

          {/* Đường gióng Peak */}
          <line x1={peakX} y1={peakY} x2={peakX} y2={height - paddingY}
            stroke="rgba(255,255,255,0.2)" strokeDasharray="2 2" />

          {/* Dot Peak */}
          <circle cx={peakX} cy={peakY} r="4.5" fill="#ffffff" stroke={lineColor} strokeWidth="2.5" />
          <g transform={`translate(${Math.min(peakX - 16, width - 50)}, ${peakY - 20})`}>
            <rect width="36" height="14" rx="4" fill="rgba(0,0,0,0.8)" stroke={`${lineColor}60`} />
            <text x="18" y="10" textAnchor="middle" fill={lineColor} fontSize="8.5" fontWeight="700" fontFamily="Space Grotesk">
              Đỉnh
            </text>
          </g>

          {/* Giờ trục x */}
          {[0, 6, 12, 18, 24].map((hr) => (
            <text key={hr} x={getX(hr)} y={height - 2}
              textAnchor="middle" fill="#475569" fontSize="8.5" fontFamily="Space Grotesk">
              {hr}h
            </text>
          ))}

          {/* Mực nước trục y */}
          {[0.5, 1.0, 1.5, 2.0].map((lv) => (
            <text key={lv} x={paddingX - 3} y={getY(lv) + 3}
              textAnchor="end" fill="#475569" fontSize="8" fontFamily="Space Grotesk">
              {lv}
            </text>
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', padding: '0 2px' }}>
        <span style={{ fontSize: '8.5px', color: '#475569', fontFamily: 'Space Grotesk' }}>Mực nước (m)</span>
        <span style={{ fontSize: '8.5px', color: '#475569', fontFamily: 'Space Grotesk' }}>Dự báo 24h TP.HCM</span>
      </div>
    </div>
  );
}
