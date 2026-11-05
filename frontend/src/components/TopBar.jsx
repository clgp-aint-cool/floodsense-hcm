import React, { useState, useEffect } from 'react';
import { waterColor } from '../severity';

// Mô tả cường độ mưa (mm/h) trung bình các trạm
function getRainLabel(mm) {
  if (mm == null) return { label: 'Chưa có dữ liệu mưa', color: '#94a3b8', icon: '🌧️' };
  if (mm >= 50) return { label: 'Mưa rất to', color: '#f43f5e', icon: '⛈️' };
  if (mm >= 25) return { label: 'Mưa to', color: '#fb923c', icon: '🌧️' };
  if (mm >= 10) return { label: 'Mưa vừa', color: '#facc15', icon: '🌦️' };
  if (mm > 0) return { label: 'Có mưa', color: '#4ade80', icon: '🌂' };
  return { label: 'Không mưa', color: '#94a3b8', icon: '🌤️' };
}

const cardStyle = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 11px', borderRadius: '10px',
  background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)',
  transition: 'all 0.25s ease',
};
const valueStyle = { fontSize: '11px', fontWeight: 800, fontFamily: 'Space Grotesk', lineHeight: 1, fontVariantNumeric: 'tabular-nums' };
const captionStyle = { fontSize: '9px', color: '#94a3b8', fontWeight: 600, marginTop: '1px' };
const divider = <span style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />;

export default function TopBar({ isPinging = false, avgWater, avgRain }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const avgColor = waterColor(avgWater);
  const rain = getRainLabel(avgRain);

  return (
    <div style={{
      position: 'absolute', top: '14px', right: '20px', zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      background: 'rgba(9, 10, 15, 0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      padding: '7px 14px', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.09)',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
    }}>
      <div style={{
        ...cardStyle,
        border: `1px solid ${avgColor}${isPinging ? '80' : '30'}`,
        background: isPinging ? `${avgColor}12` : cardStyle.background,
      }}>
        <span style={{ fontSize: '13px' }}>🌊</span>
        <div>
          <div style={{ ...valueStyle, color: avgColor, textShadow: isPinging ? `0 0 8px ${avgColor}` : 'none' }}>
            {avgWater != null ? `${Number(avgWater).toFixed(1)} cm` : 'Chưa có dữ liệu'}
          </div>
          <div style={captionStyle}>Nước ngập TB</div>
        </div>
      </div>

      {divider}

      <div style={{ ...cardStyle, border: `1px solid ${rain.color}30` }}>
        <span style={{ fontSize: '14px' }}>{rain.icon}</span>
        <div>
          <div style={{ ...valueStyle, color: rain.color }}>
            {avgRain == null ? '—' : `${Number(avgRain).toFixed(1)} mm/h`}
          </div>
          <div style={captionStyle}>{rain.label} (TB các trạm)</div>
        </div>
      </div>

      {divider}

      <div style={{ textAlign: 'center', minWidth: '82px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Space Grotesk', color: '#ffffff', letterSpacing: '0.5px', fontVariantNumeric: 'tabular-nums' }}>
          {now.toLocaleTimeString('vi-VN')}
        </div>
        <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', color: '#94a3b8', marginTop: '1px' }}>
          {now.toLocaleDateString('vi-VN')}
        </div>
      </div>
    </div>
  );
}
