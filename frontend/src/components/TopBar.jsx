import React, { useState, useEffect } from 'react';
import { User, LayoutGrid } from 'lucide-react';

// Mô tả mưa theo mm/h
function getRainLabel(mm) {
  if (mm == null) return { label: 'Chưa có dữ liệu mưa', color: '#94a3b8', icon: '🌧️' };
  if (mm >= 50) return { label: 'Mưa rất to', color: '#f43f5e', icon: '⛈️' };
  if (mm >= 25) return { label: 'Mưa to', color: '#fb923c', icon: '🌧️' };
  if (mm >= 10) return { label: 'Mưa vừa', color: '#facc15', icon: '🌦️' };
  if (mm > 0) return { label: 'Có mưa', color: '#4ade80', icon: '🌂' };
  return { label: 'Không mưa', color: '#94a3b8', icon: '🌤️' };
}

export default function TopBar({ 
  weather, 
  isPinging = false,
  avgWater,
  weatherError
}) {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('vi-VN'));
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
      setDateStr(`${now.getDate()}/${months[now.getMonth()]}/${now.getFullYear()}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Missing measurements remain unavailable.
  const rain = weather?.rainfall_mm;
  const temp = weather?.temperature_c;
  const hum = weather?.humidity_percent;
  const period = weather?.rain_period_minutes;
  const { label: rainLabel, color: rainColor, icon: rainIcon } = getRainLabel(
    rain == null || !period ? null : rain * 60 / period);
  const weatherTitle = `${weather?.source ?? ''} · ${weather?.updated_at ?? ''}`;

  const cardStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 11px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  };

  return (
    <div style={{
      position: 'absolute',
      top: '14px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(9, 10, 15, 0.88)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      padding: '7px 14px',
      borderRadius: '18px',
      border: '1px solid rgba(255, 255, 255, 0.09)',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
      flexWrap: 'wrap',
    }}>

      {/* ─── 🌊 Mực nước ngập trung bình toàn thành phố ─── */}
      {(() => {
        const avgColor = avgWater == null ? '#38bdf8' 
          : avgWater >= 50 ? '#ff0055' 
          : avgWater >= 35 ? '#ff7b00' 
          : avgWater >= 20 ? '#facc15' 
          : '#38bdf8';
        return (
          <div style={{
            ...cardStyle,
            border: isPinging ? `1px solid ${avgColor}80` : `1px solid ${avgColor}30`,
            background: isPinging ? `${avgColor}12` : cardStyle.background,
            transition: 'all 0.25s ease'
          }}>
            <span style={{ fontSize: '13px' }}>🌊</span>
            <div>
              <div style={{ 
                fontSize: '11px', 
                fontWeight: 800, 
                color: avgColor, 
                fontFamily: 'Space Grotesk', 
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                textShadow: isPinging ? `0 0 8px ${avgColor}` : 'none',
                transition: 'all 0.25s ease'
              }}>
                {avgWater != null ? `${Number(avgWater).toFixed(1)} cm` : 'Chưa có dữ liệu'}
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, marginTop: '1px' }}>
                Nước ngập TB
              </div>
            </div>
          </div>
        );
      })()}

      {weatherError && <div role="status" style={{ color: '#fbbf24', fontSize: '11px', maxWidth: '250px' }}>{weatherError}</div>}
      {/* ─── Divider ─── */}
      <span style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />

      {/* ─── 🌧 Lượng mưa ─── */}
      <div title={weatherTitle} style={{ ...cardStyle, border: `1px solid ${rainColor}30` }}>
        <span style={{ fontSize: '14px' }}>{rainIcon}</span>
        <div>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 800, 
            color: rainColor, 
            fontFamily: 'Space Grotesk', 
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {rain == null ? '—' : `${rain.toFixed(1)} mm/h`}
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, marginTop: '1px' }}>{weather?.is_forecast ? 'Mưa dự báo 1 giờ tới' : rainLabel}</div>
        </div>
      </div>

      {/* ─── 🌡 Nhiệt độ ─── */}
      <div style={cardStyle}>
        <span style={{ fontSize: '13px' }}>🌡️</span>
        <div>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 800, 
            color: '#fbbf24', 
            fontFamily: 'Space Grotesk', 
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {temp == null ? '—' : `${temp.toFixed(1)}°C`}
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, marginTop: '1px' }}>Nhiệt độ</div>
        </div>
      </div>

      {/* ─── 💧 Độ ẩm ─── */}
      <div style={cardStyle}>
        <span style={{ fontSize: '13px' }}>💧</span>
        <div>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 800, 
            color: '#38bdf8', 
            fontFamily: 'Space Grotesk', 
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {hum == null ? '—' : `${hum.toFixed(0)}%`}
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, marginTop: '1px' }}>Độ ẩm</div>
        </div>
      </div>

      {/* ─── Divider ─── */}
      <span style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />

      {/* ─── Clock ─── */}
      <div style={{ textAlign: 'center', minWidth: '82px' }}>
        <div style={{ 
          fontSize: '13px', 
          fontWeight: 700, 
          fontFamily: 'Space Grotesk', 
          color: '#ffffff', 
          letterSpacing: '0.5px',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {timeStr}
        </div>
        <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', color: '#94a3b8', marginTop: '1px' }}>
          {dateStr}
        </div>
      </div>

      {/* ─── Divider ─── */}
      <span style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />

      {/* ─── Admin ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#cbd5e1', fontSize: '11px', fontWeight: 600 }}>
          <User size={14} color="#94a3b8" />
          <span>admin</span>
        </div>
        <LayoutGrid size={14} color="#64748b" style={{ cursor: 'pointer' }} />
      </div>
    </div>
  );
}

