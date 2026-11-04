import React, { useState, useEffect } from 'react';
import FloodMap from './components/FloodMap';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
const INITIAL_DATA = {
  timestamp: null, summary: null, tides: [], severe_locations: [],
  devices: [], roads: [], zones: [], weather: null, errors: {}
};

export default function App() {
  const [data, setData] = useState(INITIAL_DATA);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [wsStatus, setWsStatus] = useState('CONNECTING'); // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'
  const [connectionError, setConnectionError] = useState('Đang kết nối backend...');
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let pingTimeout = null;
    let stopped = false;
    let lastPacketAt = 0;
    let receivedWS = false;
    const controller = new AbortController();
    const host = window.location.hostname || 'localhost';
    const local = ['5173', '3000'].includes(window.location.port);
    const base = local ? `${window.location.protocol}//${host}:8000` : window.location.origin;
    const wsUrl = `${base.replace(/^http/, 'ws')}/ws/live`;
    const applySnapshot = (parsed) => {
      if (!parsed || !Array.isArray(parsed.devices) || !parsed.summary) {
        throw new Error('Payload backend không hợp lệ.');
      }
      if (stopped) return;
      setData({ ...INITIAL_DATA, ...parsed });
      lastPacketAt = Date.now();
      setConnectionError(null);
    };
    fetch(`${base}/api/v1/dashboard`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);
        return res.json();
      })
      .then(parsed => { if (!receivedWS) applySnapshot(parsed); })
      .catch(error => {
        if (!stopped && !receivedWS && error.name !== 'AbortError') {
          setConnectionError('Không tải được dữ liệu backend. Đang thử kết nối realtime.');
        }
      });
    const reconnect = () => {
      if (!stopped) reconnectTimeout = setTimeout(connect, 4000);
    };
    const connect = () => {
      if (stopped) return;
      setWsStatus('CONNECTING');
      try {
        const socket = new WebSocket(wsUrl);
        ws = socket;
        socket.onopen = () => { if (!stopped) setWsStatus('WAITING'); };
        socket.onmessage = event => {
          if (stopped || ws !== socket) return;
          try {
            applySnapshot(JSON.parse(event.data));
            receivedWS = true;
            setWsStatus('CONNECTED');
            setIsPinging(true);
            clearTimeout(pingTimeout);
            pingTimeout = setTimeout(() => setIsPinging(false), 500);
          } catch {
            setConnectionError('Dữ liệu realtime không hợp lệ.');
            setWsStatus('ERROR');
          }
        };
        socket.onerror = () => socket.close();
        socket.onclose = () => {
          if (stopped || ws !== socket) return;
          setWsStatus('DISCONNECTED');
          setIsPinging(false);
          setConnectionError('Mất kết nối realtime. Đang kết nối lại; dữ liệu cũ đã ẩn.');
          setData(INITIAL_DATA);
          reconnect();
        };
      } catch {
        setConnectionError('Không mở được kết nối realtime.');
        setWsStatus('DISCONNECTED');
        reconnect();
      }
    };
    connect();
    const watchdog = setInterval(() => {
      if (lastPacketAt && Date.now() - lastPacketAt > 20000) {
        setConnectionError('Backend không cập nhật trong 20 giây. Đang kết nối lại.');
        setData(INITIAL_DATA);
        setWsStatus('DISCONNECTED');
        lastPacketAt = 0;
        ws?.close();
      }
    }, 2000);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(reconnectTimeout);
      clearTimeout(pingTimeout);
      clearInterval(watchdog);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Fullscreen Map (Chỉ hiển thị TP.HCM, phân loại Đường vs Khu vực ngập) */}
      <FloodMap 
        devices={data.devices} 
        severeLocations={data.severe_locations} 
        roads={data.roads || []}
        zones={data.zones || []}
        selectedLocation={selectedLocation}
      />

      {/* Floating Glassmorphism Sidebar (Dự báo Triều cường + Cảnh báo Đường/Khu vực + IoT Realtime Summary) */}
      <Sidebar 
        tides={data.tides} 
        severeLocations={data.severe_locations} 
        roads={data.roads || []}
        zones={data.zones || []}
        summary={data.summary}
        weather={data.weather}
        isPinging={isPinging}
        wsStatus={wsStatus}
        errors={data.errors}
        connectionError={connectionError}
        onSelectLocation={(loc) => setSelectedLocation(loc)}
      />

      {/* Floating Top Bar (Mực nước TB, Thời tiết & Clock) */}
      <TopBar 
        weather={data.weather} 
        isPinging={isPinging}
        avgWater={data.summary?.avg_water_level_cm}
        weatherError={connectionError || data.errors?.weather}
      />
    </div>
  );
}
