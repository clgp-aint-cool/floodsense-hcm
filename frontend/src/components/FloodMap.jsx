import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Navigation, Plus, Minus } from 'lucide-react';
import { SEVERITY, LEVELS } from '../severity';

// Khoá bản đồ trong phạm vi TP.HCM
const HCMC_BOUNDS = [[10.55, 106.48], [10.98, 106.84]];
const HCMC_CENTER = [10.776, 106.665];

const buttonStyle = {
  width: '40px', height: '40px', borderRadius: '12px',
  background: 'rgba(14, 17, 23, 0.88)', backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#f8fafc', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
};

function markerIcon(color, offline) {
  return L.divIcon({
    className: 'custom-road-node-icon', iconSize: [20, 20], iconAnchor: [10, 10],
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        ${offline ? '' : `<div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background: ${color}; opacity: 0.35; animation: radar-ping 2.2s infinite;"></div>`}
        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; border: 2px solid ${offline ? '#64748b' : '#ffffff'}; box-shadow: ${offline ? 'none' : `0 0 10px ${color}`}; z-index: 5;"></div>
      </div>`,
  });
}

function popupHtml(dev, color) {
  const water = dev.water_level_cm == null ? 'Chưa có dữ liệu' : `${dev.water_level_cm} cm`;
  const rain = dev.rainfall_mm == null ? '—' : `${dev.rainfall_mm} mm/h`;
  return `
    <div style="padding: 10px; font-family: 'Plus Jakarta Sans', sans-serif; min-width: 220px;">
      <div style="font-weight: 800; font-size: 13px; color: #f8fafc; margin-bottom: 2px;">📡 ${dev.station_node}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">${dev.parent_name} · ${dev.district} · ${dev.device_id}</div>
      <div style="background: rgba(255,255,255,0.06); padding: 8px; border-radius: 8px; font-size: 11px; color: #94a3b8;">
        <div style="display: flex; justify-content: space-between;">
          <span>Mực nước:</span>
          <span style="font-size: 14px; font-weight: 800; font-family: 'Space Grotesk'; color: ${color};">${water}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span>Mưa:</span><span style="color: #e2e8f0; font-weight: 700;">${rain}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span>Trạng thái:</span>
          <span style="font-weight: 700; color: ${color};">${dev.status}${dev.error ? `: ${dev.error}` : ''}</span>
        </div>
      </div>
    </div>`;
}

export default function FloodMap({ devices = [], selectedLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: HCMC_CENTER, zoom: 13, minZoom: 12, maxZoom: 18,
      zoomSnap: 0.25, zoomDelta: 0.5,
      maxBounds: HCMC_BOUNDS, maxBoundsViscosity: 1.0,
      zoomControl: false, attributionControl: false,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Mỗi trạm là một điểm, màu theo mức ngập
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.clearLayers();
    devices.forEach(dev => {
      const { color } = SEVERITY[dev.status] || SEVERITY.OFFLINE;
      L.marker([dev.latitude, dev.longitude], { icon: markerIcon(color, dev.status === 'OFFLINE') })
        .bindPopup(popupHtml(dev, color))
        .addTo(layerRef.current);
    });
  }, [devices]);

  useEffect(() => {
    if (mapRef.current && selectedLocation) {
      mapRef.current.flyTo([selectedLocation.latitude, selectedLocation.longitude], 15, { duration: 1.2 });
    }
  }, [selectedLocation]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <div style={{ position: 'absolute', top: '90px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button style={buttonStyle} title="Về trung tâm TP.HCM" onClick={() => mapRef.current?.flyTo(HCMC_CENTER, 13)}><Navigation size={18} /></button>
        <button style={buttonStyle} title="Phóng to" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></button>
        <button style={buttonStyle} title="Thu nhỏ" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></button>
      </div>

      <div style={{
        position: 'absolute', bottom: '24px', left: '430px', zIndex: 1000,
        background: 'rgba(14, 17, 23, 0.94)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '14px',
        padding: '11px 18px', display: 'flex', alignItems: 'center', gap: '18px',
        boxShadow: '0 12px 35px rgba(0,0,0,0.6)', pointerEvents: 'none',
      }}>
        {LEVELS.map(key => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: SEVERITY[key].color, boxShadow: `0 0 8px ${SEVERITY[key].color}` }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: SEVERITY[key].color }}>{SEVERITY[key].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
