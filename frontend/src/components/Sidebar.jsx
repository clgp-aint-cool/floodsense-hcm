import React, { useState } from 'react';
import { Droplets, AlertTriangle, ChevronRight, Activity, Flame, MapPin, Zap } from 'lucide-react';
import { SEVERITY, LEVELS, waterColor } from '../severity';

const isFlooded = d => d.status !== 'SAFE' && d.status !== 'OFFLINE';

function Metric({ label, value, unit, color, highlight }) {
  return (
    <div style={{
      padding: '7px 6px', borderRadius: '10px', textAlign: 'center',
      background: highlight ? `${color}14` : `${color}0d`,
      border: `1px solid ${color}${highlight ? '60' : '38'}`,
      transition: 'all 0.25s ease',
    }}>
      <div style={{ fontSize: '8.5px', color, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '14.5px', fontWeight: 800, fontFamily: 'Space Grotesk', color, lineHeight: 1.2, marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
        {value}<span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '1px' }}>{unit}</span>
      </div>
    </div>
  );
}

export default function Sidebar({
  devices = [],
  summary,
  isPinging = false,
  wsStatus = 'CONNECTING',
  errors = {},
  connectionError,
  onSelectLocation,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [onlyFlooded, setOnlyFlooded] = useState(false);

  // Trạm ngập sâu nhất lên đầu, trạm mất tín hiệu xuống cuối
  const sorted = [...devices].sort((a, b) => (b.water_level_cm ?? -1) - (a.water_level_cm ?? -1));
  const floodedCount = devices.filter(isFlooded).length;
  const shown = onlyFlooded ? sorted.filter(isFlooded) : sorted;
  const avg = summary?.avg_water_level_cm;
  const connected = wsStatus === 'CONNECTED';

  const tabStyle = active => ({
    padding: '5px 0', borderRadius: '7px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
    color: active ? '#38bdf8' : '#94a3b8',
  });

  return (
    <aside className="glass-sidebar" style={{
      position: 'absolute', top: '16px', left: '16px', bottom: '16px', width: '410px', zIndex: 1000,
      display: 'flex', flexDirection: 'column', borderRadius: '24px', padding: '20px 18px', overflowY: 'auto',
    }}>
      {/* Tiêu đề */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexShrink: 0 }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(6, 182, 212, 0.45)',
        }}>
          <Droplets size={22} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px', color: '#ffffff' }}>FloodSense HCM</h1>
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', color: '#94a3b8', textTransform: 'uppercase' }}>
            Trạm quan trắc ngập đô thị
          </p>
        </div>
      </div>

      {/* Tổng quan realtime */}
      <div style={{
        marginBottom: '16px', padding: '12px 14px', borderRadius: '16px', flexShrink: 0,
        background: 'rgba(14, 20, 30, 0.90)', border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={13} color="#38bdf8" />
            <span style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.8px', color: '#f8fafc', textTransform: 'uppercase' }}>
              Giám sát realtime
            </span>
          </div>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 7px', borderRadius: '6px',
            background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)',
            fontSize: '9.5px', fontWeight: 700, color: '#38bdf8',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8',
              boxShadow: isPinging ? '0 0 10px #38bdf8' : '0 0 4px #38bdf8',
              transform: isPinging ? 'scale(1.3)' : 'scale(1)', transition: 'all 0.2s ease',
            }} />
            <span className="tabular-nums">{summary?.total_active_devices ?? 0}/{summary?.total_devices ?? devices.length} TRẠM ONLINE</span>
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
          <Metric label="Nước TB" value={avg != null ? Number(avg).toFixed(1) : '—'} unit="cm" color={waterColor(avg)} highlight={isPinging} />
          <Metric label="Nguy cấp" value={summary?.critical_count ?? 0} unit="trạm" color="#f43f5e" />
          <Metric label="Cảnh báo" value={summary?.alert_count ?? 0} unit="trạm" color="#facc15" />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8',
          paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={10} color="#10b981" />
            Kết nối realtime: <strong style={{ color: '#cbd5e1' }}>{connected ? 'Đã nhận dữ liệu' : 'Đang chờ dữ liệu'}</strong>
          </span>
          <span style={{ color: connected ? '#10b981' : '#94a3b8', fontWeight: 700 }}>
            {connected ? 'WS ĐÃ KẾT NỐI' : 'CHƯA KẾT NỐI'}
          </span>
        </div>
      </div>

      {(connectionError || errors.telemetry) && (
        <div role="alert" style={{ padding: '10px', marginBottom: '12px', color: '#fbbf24', border: '1px solid #fbbf2455', borderRadius: '10px', fontSize: '12px' }}>
          {connectionError || errors.telemetry}
        </div>
      )}

      {/* Danh sách trạm */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <MapPin size={14} color="#facc15" />
        <h2 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', color: '#cbd5e1', textTransform: 'uppercase' }}>
          Trạm quan trắc ({devices.length})
        </h2>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px',
        background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '10px',
      }}>
        <button style={tabStyle(!onlyFlooded)} onClick={() => setOnlyFlooded(false)}>Tất cả ({devices.length})</button>
        <button style={tabStyle(onlyFlooded)} onClick={() => setOnlyFlooded(true)}>Đang ngập ({floodedCount})</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {shown.map(dev => {
          const cfg = SEVERITY[dev.status] || SEVERITY.OFFLINE;
          const selected = dev.device_id === selectedId;
          return (
            <div
              key={dev.device_id}
              className="glass-card"
              onClick={() => { setSelectedId(dev.device_id); onSelectLocation?.(dev); }}
              style={{
                padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                border: selected ? `1px solid ${cfg.color}99` : undefined,
                background: selected ? `${cfg.color}15` : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#f1f5f9' }}>{dev.station_node}</div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                    {dev.parent_name} · {dev.district}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 800, fontFamily: 'Space Grotesk', color: cfg.color, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                    {dev.water_level_cm == null ? '—' : `${dev.water_level_cm}cm`}
                  </span>
                  <span style={{
                    fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '5px',
                    background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}55`,
                    display: 'flex', alignItems: 'center', gap: '3px',
                  }}>
                    {dev.status === 'CRITICAL' ? <Flame size={10} /> : <AlertTriangle size={10} />}
                    {dev.status}
                  </span>
                  <ChevronRight size={13} color="#64748b" />
                </div>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '11px' }}>
            {onlyFlooded ? 'Không có trạm nào đang ngập.' : 'Chưa có dữ liệu trạm.'}
          </div>
        )}
      </div>

      {/* Chú thích */}
      <div style={{
        paddingTop: '10px', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '9.5px', fontWeight: 600, flexShrink: 0,
      }}>
        {LEVELS.map(key => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: SEVERITY[key].color }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SEVERITY[key].color, boxShadow: `0 0 6px ${SEVERITY[key].color}` }} />
            <span>{SEVERITY[key].label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
