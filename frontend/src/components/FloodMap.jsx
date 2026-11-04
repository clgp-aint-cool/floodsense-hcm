import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Navigation, Plus, Minus, Layers, Radio, Waves } from 'lucide-react';

// Bảng màu Neon tương phản cao cho bản đồ nền tối (High-Contrast Neon Dark Mode)
const SEVERITY_CONFIG = {
  SAFE: {
    color: '#06b6d4',      // Cyan Neon
    bg: 'rgba(6, 182, 212, 0.16)',
    border: 'rgba(6, 182, 212, 0.45)',
    glow: '0 0 14px rgba(6, 182, 212, 0.7)',
    label: 'An toàn (<20cm)',
    advisory: 'Mực nước an toàn. Các phương tiện di chuyển bình thường.'
  },
  ALERT: {
    color: '#facc15',      // Amber Gold Neon
    bg: 'rgba(250, 204, 21, 0.16)',
    border: 'rgba(250, 204, 21, 0.45)',
    glow: '0 0 16px rgba(250, 204, 21, 0.75)',
    label: 'Cảnh báo (20–35cm)',
    advisory: 'Đường ngập nhẹ. Lưu thông chậm, cẩn trọng vùng trũng mép đường.'
  },
  WARNING: {
    color: '#ff7b00',      // Vivid Orange Neon
    bg: 'rgba(255, 123, 0, 0.20)',
    border: 'rgba(255, 123, 0, 0.50)',
    glow: '0 0 20px rgba(255, 123, 0, 0.85)',
    label: 'Nguy cơ cao (35–50cm)',
    advisory: 'Xe máy có nguy cơ chết máy. Nên chọn lộ trình tránh ngập thay thế.'
  },
  CRITICAL: {
    color: '#ff0055',      // Crimson Neon (Glow rực rỡ)
    bg: 'rgba(255, 0, 85, 0.24)',
    border: 'rgba(255, 0, 85, 0.60)',
    glow: '0 0 24px rgba(255, 0, 85, 0.95)',
    label: 'Ngập cực sâu (>50cm)',
    advisory: '⛔ NGUY HIỂM: Cấm xe máy & ô tô gầm thấp qua lại. Chuyển hướng ngay!'
  },
  OFFLINE: {
    color: '#64748b',      // Slate Gray
    bg: 'rgba(100, 116, 139, 0.16)',
    border: 'rgba(100, 116, 139, 0.40)',
    glow: 'none',
    label: 'Mất tín hiệu (Offline)',
    advisory: 'Trạm cảm biến hiện không có dữ liệu truyền về.'
  }
};

// Giới hạn không gian địa lý khóa chặt trong phạm vi TP.HCM (loại bỏ hoàn toàn Đồng Nai, Long Thành, Bình Dương)
const HCMC_BOUNDS = [
  [10.5500, 106.4800], // Tây Nam TP.HCM (Bình Chánh / Nhà Bè)
  [10.9800, 106.8400]  // Đông Bắc TP.HCM (TP. Thủ Đức - ranh giới Sông Đồng Nai, chặn qua Long Thành)
];

export default function FloodMap({ selectedLocation, roads = [], zones = [], devices = [] }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const roadsLayerRef = useRef(null);
  const zonesLayerRef = useRef(null);
  const nodesLayerRef = useRef(null);

  // Bộ lọc hiển thị các lớp cảnh báo
  const [showRoads, setShowRoads] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showSensors, setShowSensors] = useState(true);

  // 1. Khởi tạo Leaflet Map với giới hạn viewport TP.HCM
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.7760, 106.6650], // Căn tâm khu vực đô thị nội thành TP.HCM (bù trừ cho sidebar 410px bên trái)
      zoom: 13,
      minZoom: 12,
      maxZoom: 18,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxBounds: HCMC_BOUNDS,
      maxBoundsViscosity: 1.0, // Khóa cứng bản đồ, không thể kéo ra khỏi TP.HCM
      zoomControl: false,
      attributionControl: false
    });

    // Dark-mode Map Tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    zonesLayerRef.current = L.layerGroup().addTo(map);
    roadsLayerRef.current = L.layerGroup().addTo(map);
    nodesLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Vẽ 6 Tuyến đường ngập bám theo đúng tim đường OpenStreetMap
  useEffect(() => {
    if (!mapRef.current || !roadsLayerRef.current) return;
    roadsLayerRef.current.clearLayers();

    if (!showRoads || !roads || roads.length === 0) return;

    roads.forEach(road => {
      const maxWater = road.max_water_cm;
      const avgWater = road.avg_water_cm;
      const severity = road.severity || 'OFFLINE';
      const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.OFFLINE;
      const color = cfg.color;

      if (road.coordinates && road.coordinates.length > 1) {
        // Lớp vầng sáng Neon phát quang (Glow Halo)
        const haloLine = L.polyline(road.coordinates, {
          color: color,
          weight: 14,
          opacity: 0.30,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'neon-road-halo'
        });

        // Đường chỉ thị ngập chính (Vibrant Centerline)
        const mainLine = L.polyline(road.coordinates, {
          color: color,
          weight: 6.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          className: `neon-road-line ${severity === 'CRITICAL' ? 'neon-road-pulse' : ''}`
        });

        const popupContent = `
          <div style="padding: 12px; font-family: 'Plus Jakarta Sans', sans-serif; min-width: 270px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 15px;">🛣️</span>
                <span style="font-weight: 800; font-size: 14px; color: #f8fafc;">${road.name}</span>
              </div>
              <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${cfg.bg}; color: ${color}; border: 1px solid ${cfg.border};">
                ${severity}
              </span>
            </div>
            
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">
              Khu vực: <span style="color: #cbd5e1; font-weight: 600;">${road.district}</span> • Dài: <span style="font-family: 'Space Grotesk'; color: #38bdf8;">${road.length_km} km</span>
            </div>

            <div style="background: rgba(255,255,255,0.05); padding: 9px; border-radius: 9px; margin-bottom: 9px; border: 1px solid rgba(255,255,255,0.08);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
                <span style="color: #94a3b8;">Độ sâu cao nhất:</span>
                <span style="font-weight: 800; font-family: 'Space Grotesk'; color: ${color}; font-size: 14px;">
                  ↑ ${maxWater == null ? 'Chưa có dữ liệu' : `${maxWater} cm`}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: #94a3b8;">Mực nước trung bình:</span>
                <span style="font-weight: 700; font-family: 'Space Grotesk'; color: #e2e8f0;">
                  ${avgWater == null ? 'Chưa có dữ liệu' : `${avgWater} cm`}
                </span>
              </div>
            </div>

            <!-- Gợi ý lộ trình tránh ngập -->
            <div style="font-size: 11px; line-height: 1.4; color: #f8fafc; background: ${cfg.bg}; border: 1px solid ${cfg.border}; padding: 8px 10px; border-radius: 8px;">
              <div style="font-weight: 700; color: ${color}; margin-bottom: 3px;">
                💡 Khuyến cáo lộ trình:
              </div>
              ${severity === 'OFFLINE' ? 'Không có telemetry mới từ cảm biến.' : road.avoid_advice || cfg.advisory}
            </div>
          </div>
        `;

        mainLine.bindPopup(popupContent);
        haloLine.bindPopup(popupContent);

        roadsLayerRef.current.addLayer(haloLine);
        roadsLayerRef.current.addLayer(mainLine);
      }
    });
  }, [roads, showRoads]);

  // 3. Vẽ 4 Khu vực ngập diện rộng (Flooded Zones / Retention Basins)
  useEffect(() => {
    if (!mapRef.current || !zonesLayerRef.current) return;
    zonesLayerRef.current.clearLayers();

    if (!showZones || !zones || zones.length === 0) return;

    zones.forEach(zone => {
      const maxWater = zone.max_water_cm;
      const avgWater = zone.avg_water_cm;
      const severity = zone.severity || 'OFFLINE';
      const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.OFFLINE;
      const color = cfg.color;

      if (zone.polygon && zone.polygon.length > 2) {
        const zonePolygon = L.polygon(zone.polygon, {
          color: color,
          weight: 2.5,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.16,
          dashArray: '6, 6',
          className: 'flood-zone-boundary'
        });

        const centerCircle = L.circle(zone.center, {
          radius: 350,
          color: color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.35,
          className: 'flood-core-zone'
        });

        const popupContent = `
          <div style="padding: 12px; font-family: 'Plus Jakarta Sans', sans-serif; min-width: 270px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 15px;">🌊</span>
                <span style="font-weight: 800; font-size: 14px; color: #f8fafc;">${zone.name}</span>
              </div>
              <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${cfg.bg}; color: ${color}; border: 1px solid ${cfg.border};">
                ${severity}
              </span>
            </div>
            
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">
              Khu vực: <span style="color: #cbd5e1; font-weight: 600;">${zone.district}</span> • Diện tích: <span style="font-family: 'Space Grotesk'; color: #38bdf8;">~${zone.area_km2} km²</span>
            </div>

            <div style="background: rgba(255,255,255,0.05); padding: 9px; border-radius: 9px; margin-bottom: 9px; border: 1px solid rgba(255,255,255,0.08);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
                <span style="color: #94a3b8;">Độ sâu rốn ngập:</span>
                <span style="font-weight: 800; font-family: 'Space Grotesk'; color: ${color}; font-size: 14px;">
                  ↑ ${maxWater == null ? 'Chưa có dữ liệu' : `${maxWater} cm`}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: #94a3b8;">Mực nước trung bình vùng:</span>
                <span style="font-weight: 700; font-family: 'Space Grotesk'; color: #e2e8f0;">
                  ${avgWater == null ? 'Chưa có dữ liệu' : `${avgWater} cm`}
                </span>
              </div>
            </div>

            <div style="font-size: 11px; line-height: 1.4; color: #f8fafc; background: ${cfg.bg}; border: 1px solid ${cfg.border}; padding: 8px 10px; border-radius: 8px;">
              <div style="font-weight: 700; color: ${color}; margin-bottom: 3px;">
                ⚠️ Cảnh báo ngập diện rộng:
              </div>
              ${severity === 'OFFLINE' ? 'Không có telemetry mới từ cảm biến.' : zone.avoid_advice || cfg.advisory}
            </div>
          </div>
        `;

        zonePolygon.bindPopup(popupContent);
        centerCircle.bindPopup(popupContent);

        zonesLayerRef.current.addLayer(zonePolygon);
        zonesLayerRef.current.addLayer(centerCircle);
      }
    });
  }, [zones, showZones]);

  // 4. Vẽ 50 Trạm quan trắc IoT cố định (30 trạm đường + 20 trạm khu vực)
  useEffect(() => {
    if (!mapRef.current || !nodesLayerRef.current) return;
    nodesLayerRef.current.clearLayers();

    if (!showSensors) return;

    const renderedNodeIds = new Set();

    // Vẽ trạm thuộc Tuyến đường
    roads?.forEach(road => {
      road.nodes?.forEach((node, nodeIdx) => {
        renderedNodeIds.add(node.id);
        renderedNodeIds.add(node.name);
        const lat = node.latitude ?? node.lat;
        const lon = node.longitude ?? node.lon;
        if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;

        const water = node.water_level_cm;
        const status = node.status || 'OFFLINE';
        const cfg = SEVERITY_CONFIG[status] || SEVERITY_CONFIG.OFFLINE;
        const color = cfg.color;
        const isOffline = status === 'OFFLINE';

        const iconHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${!isOffline ? `<div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background: ${color}; opacity: 0.35; animation: radar-ping 2.2s infinite;"></div>` : ''}
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; border: 2px solid ${isOffline ? '#64748b' : '#ffffff'}; box-shadow: ${isOffline ? 'none' : `0 0 10px ${color}`}; z-index: 5;"></div>
          </div>
        `;

        const icon = L.divIcon({ html: iconHtml, className: 'custom-road-node-icon', iconSize: [20, 20], iconAnchor: [10, 10] });
        const marker = L.marker([lat, lon], { icon: icon });

        const popup = `
          <div style="padding: 10px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 13px;">📡</span>
              <span style="font-weight: 800; font-size: 13px; color: #f8fafc;">${node.name}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
              Tuyến: <span style="color: #e2e8f0; font-weight: 600;">${road.name}</span> (Trạm #${nodeIdx + 1}/5)
            </div>
            <div style="background: rgba(255,255,255,0.06); padding: 8px; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #94a3b8;">Mực nước đo được:</span>
                <span style="font-size: 14px; font-weight: 800; font-family: 'Space Grotesk'; color: ${color};">
                  ${water == null ? 'Chưa có dữ liệu' : `${water} cm`}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                <span style="font-size: 11px; color: #94a3b8;">Trạng thái:</span>
                <span style="font-size: 11px; font-weight: 700; color: ${color};">${status}${node.error ? `: ${node.error}` : ''}</span>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popup);
        nodesLayerRef.current.addLayer(marker);
      });
    });

    // Vẽ trạm thuộc Khu vực ngập
    zones?.forEach(zone => {
      zone.nodes?.forEach((node, nodeIdx) => {
        renderedNodeIds.add(node.id);
        renderedNodeIds.add(node.name);
        const lat = node.latitude ?? node.lat;
        const lon = node.longitude ?? node.lon;
        if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;

        const water = node.water_level_cm;
        const status = node.status || 'OFFLINE';
        const cfg = SEVERITY_CONFIG[status] || SEVERITY_CONFIG.OFFLINE;
        const color = cfg.color;
        const isOffline = status === 'OFFLINE';

        const iconHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${!isOffline ? `<div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background: ${color}; opacity: 0.35; animation: radar-ping 2.2s infinite;"></div>` : ''}
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; border: 2px solid ${isOffline ? '#64748b' : '#ffffff'}; box-shadow: ${isOffline ? 'none' : `0 0 10px ${color}`}; z-index: 5;"></div>
          </div>
        `;

        const icon = L.divIcon({ html: iconHtml, className: 'custom-road-node-icon', iconSize: [20, 20], iconAnchor: [10, 10] });
        const marker = L.marker([lat, lon], { icon: icon });

        const popup = `
          <div style="padding: 10px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 13px;">📡</span>
              <span style="font-weight: 800; font-size: 13px; color: #f8fafc;">${node.name}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
              Khu vực: <span style="color: #e2e8f0; font-weight: 600;">${zone.name}</span> (Trạm #${nodeIdx + 1}/5)
            </div>
            <div style="background: rgba(255,255,255,0.06); padding: 8px; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #94a3b8;">Mực nước đo được:</span>
                <span style="font-size: 14px; font-weight: 800; font-family: 'Space Grotesk'; color: ${color};">
                  ${water == null ? 'Chưa có dữ liệu' : `${water} cm`}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                <span style="font-size: 11px; color: #94a3b8;">Trạng thái:</span>
                <span style="font-size: 11px; font-weight: 700; color: ${color};">${status}${node.error ? `: ${node.error}` : ''}</span>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popup);
        nodesLayerRef.current.addLayer(marker);
      });
    });

    // Vẽ các trạm quan trắc mở rộng / di động (ví dụ DEMO-SURGE-001..150)
    devices?.forEach(dev => {
      if (renderedNodeIds.has(dev.device_id) || renderedNodeIds.has(dev.name)) return;
      const lat = dev.latitude ?? dev.lat;
      const lon = dev.longitude ?? dev.lon;
      if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;

      const water = dev.water_level_cm;
      const status = dev.status || 'OFFLINE';
      const cfg = SEVERITY_CONFIG[status] || SEVERITY_CONFIG.OFFLINE;
      const color = cfg.color;
      const isOffline = status === 'OFFLINE';

      const iconHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${!isOffline ? `<div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: ${color}; opacity: 0.38; animation: radar-ping 1.8s infinite;"></div>` : ''}
          <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; border: 2px solid ${isOffline ? '#64748b' : '#ffffff'}; box-shadow: ${isOffline ? 'none' : `0 0 10px ${color}`}; z-index: 5;"></div>
        </div>
      `;

      const icon = L.divIcon({ html: iconHtml, className: 'custom-road-node-icon', iconSize: [22, 22], iconAnchor: [11, 11] });
      const marker = L.marker([lat, lon], { icon: icon });

      const popup = `
        <div style="padding: 10px; font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 13px;">📡</span>
            <span style="font-weight: 800; font-size: 13px; color: #f8fafc;">${dev.name || dev.device_id}</span>
          </div>
          <div style="font-size: 11px; color: #38bdf8; font-weight: 600; margin-bottom: 8px;">
            Trạm di động / Phụ tải realtime TP.HCM
          </div>
          <div style="background: rgba(255,255,255,0.06); padding: 8px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #94a3b8;">Mực nước đo được:</span>
              <span style="font-size: 14px; font-weight: 800; font-family: 'Space Grotesk'; color: ${color};">
                ${water == null ? 'Chưa có dữ liệu' : `${water} cm`}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span style="font-size: 11px; color: #94a3b8;">Trạng thái:</span>
              <span style="font-size: 11px; font-weight: 700; color: ${color};">${status}</span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popup);
      nodesLayerRef.current.addLayer(marker);
    });
  }, [roads, zones, devices, showSensors]);

  // 5. FitBounds / FlyTo khi click vào Tuyến đường hoặc Khu vực từ Sidebar
  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return;

    try {
      const paddingOptions = {
        paddingTopLeft: [typeof window !== 'undefined' && window.innerWidth > 768 ? 430 : 40, 50],
        paddingBottomRight: [50, 50],
        maxZoom: 15,
        duration: 1.2
      };
      if (selectedLocation.coordinates && selectedLocation.coordinates.length > 0) {
        mapRef.current.fitBounds(selectedLocation.coordinates, paddingOptions);
      } else if (selectedLocation.polygon && selectedLocation.polygon.length > 0) {
        mapRef.current.fitBounds(selectedLocation.polygon, paddingOptions);
      } else {
        const lat = selectedLocation.latitude ?? selectedLocation.lat ?? selectedLocation.center?.[0];
        const lon = selectedLocation.longitude ?? selectedLocation.lon ?? selectedLocation.center?.[1];
        if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
          mapRef.current.flyTo([lat, lon], 14, { duration: 1.2 });
        }
      }
    } catch (e) {
      console.warn("Navigation error:", e);
    }
  }, [selectedLocation]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleRecenter = () => mapRef.current?.flyTo([10.7760, 106.6650], 13);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Khung bản đồ Leaflet */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Controls trên góc phải */}
      <div style={{
        position: 'absolute',
        top: '90px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <button 
          onClick={handleRecenter}
          title="Về trung tâm TP.HCM"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(14, 17, 23, 0.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f8fafc',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            transition: 'all 0.2s'
          }}
        >
          <Navigation size={18} />
        </button>

        <button 
          onClick={handleZoomIn}
          title="Phóng to"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(14, 17, 23, 0.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f8fafc',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            transition: 'all 0.2s'
          }}
        >
          <Plus size={18} />
        </button>

        <button 
          onClick={handleZoomOut}
          title="Thu nhỏ"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(14, 17, 23, 0.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f8fafc',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            transition: 'all 0.2s'
          }}
        >
          <Minus size={18} />
        </button>

        {/* Nút bật tắt Tuyến đường ngập (🛣️) */}
        <button 
          onClick={() => setShowRoads(!showRoads)}
          title={showRoads ? "Ẩn tuyến đường ngập" : "Hiện tuyến đường ngập"}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: showRoads ? 'rgba(2, 132, 199, 0.45)' : 'rgba(14, 17, 23, 0.88)',
            backdropFilter: 'blur(12px)',
            border: showRoads ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: showRoads ? '#38bdf8' : '#f8fafc',
            cursor: 'pointer',
            boxShadow: showRoads ? '0 0 15px rgba(56, 189, 248, 0.4)' : '0 8px 20px rgba(0,0,0,0.4)',
            transition: 'all 0.2s'
          }}
        >
          <Layers size={18} />
        </button>

        {/* Nút bật tắt Khu vực ngập (🌊) */}
        <button 
          onClick={() => setShowZones(!showZones)}
          title={showZones ? "Ẩn khu vực ngập" : "Hiện khu vực ngập"}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: showZones ? 'rgba(244, 63, 94, 0.45)' : 'rgba(14, 17, 23, 0.88)',
            backdropFilter: 'blur(12px)',
            border: showZones ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: showZones ? '#f43f5e' : '#f8fafc',
            cursor: 'pointer',
            boxShadow: showZones ? '0 0 15px rgba(244, 63, 94, 0.4)' : '0 8px 20px rgba(0,0,0,0.4)',
            transition: 'all 0.2s'
          }}
        >
          <Waves size={18} />
        </button>

        {/* Nút bật tắt 50 Trạm cảm biến IoT (📡) */}
        <button 
          onClick={() => setShowSensors(!showSensors)}
          title={showSensors ? "Ẩn 50 trạm IoT" : "Hiện 50 trạm IoT"}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: showSensors ? 'rgba(16, 185, 129, 0.35)' : 'rgba(14, 17, 23, 0.88)',
            backdropFilter: 'blur(12px)',
            border: showSensors ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: showSensors ? '#10b981' : '#f8fafc',
            cursor: 'pointer',
            boxShadow: showSensors ? '0 0 15px rgba(16, 185, 129, 0.4)' : '0 8px 20px rgba(0,0,0,0.4)',
            transition: 'all 0.2s'
          }}
        >
          <Radio size={18} />
        </button>
      </div>

      {/* Floating High-Contrast Legend ở góc dưới bên trái */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '430px',
        zIndex: 1000,
        background: 'rgba(14, 17, 23, 0.94)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '14px',
        padding: '11px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
        pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: '#06b6d4', boxShadow: '0 0 8px #06b6d4' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#06b6d4' }}>&lt;20cm (An toàn)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: '#facc15', boxShadow: '0 0 8px #facc15' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#facc15' }}>20–35cm (Cảnh báo)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: '#ff7b00', boxShadow: '0 0 8px #ff7b00' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff7b00' }}>35–50cm (Nguy cơ)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: '#ff0055', boxShadow: '0 0 10px #ff0055' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#ff0055' }}>&gt;50cm (Ngập sâu)</span>
        </div>
      </div>
    </div>
  );
}
