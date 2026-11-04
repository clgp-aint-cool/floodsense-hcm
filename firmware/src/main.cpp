// Firmware trạm quan trắc ngập (ESP32). Skeleton: luồng chính + các hàm cần cài đặt.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>

#include "config.h"
#include "flood/flood_station.hpp"
#include "hal/esp32_hal.h"

ArduinoClock clockSrc;
JsnSr04tSensor distanceSensor(PIN_US_TRIG, PIN_US_ECHO);
TippingBucketGauge rainGauge(PIN_RAIN_TIP);
LedBuzzerAlarm alarmOut(PIN_LED_GREEN, PIN_LED_YELLOW, PIN_LED_RED, PIN_BUZZER);
flood::FloodStation station({clockSrc, distanceSensor, rainGauge, alarmOut},
                            flood::StationSettings{});

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

// ---- Kết nối ----
void connectWifi();                 // TODO: WiFi.begin + chờ có IP, có timeout
bool loadAccessToken(String& out);  // TODO: đọc token từ NVS (Preferences)
bool provisionDevice(String& out);  // TODO: MQTT /provision/request như device-sim
bool connectMqtt(const String& token);  // TODO: connect + subscribe rpc/attributes + gửi client attributes

// ---- Dữ liệu ----
void publishTelemetry(const flood::Telemetry& t);  // TODO: ArduinoJson, cùng key với device-sim/telemetry_json.cpp
void bufferOffline(const flood::Telemetry& t);     // TODO: ring buffer khi mất mạng
void flushOfflineBuffer();                          // TODO: gửi bù khi kết nối lại

// ---- Điều khiển từ xa ----
void onMqttMessage(char* topic, byte* payload, unsigned int length);  // TODO: phân loại rpc / attributes
void handleRpc(const char* requestId, const char* method, JsonVariantConst params);  // getStatus, muteSiren (tắt còi thay nút nhấn), testSiren, setInterval, reboot
void applySharedAttributes(JsonVariantConst attrs);  // alert_cm, warning_cm, critical_cm

// ---- Giao diện tại chỗ ----
void updateLcd(const flood::Telemetry& t);  // TODO: dòng 1 "H=42.5cm WARN", dòng 2 "R=12mm WiFi"

void setup() {
    Serial.begin(115200);
    distanceSensor.begin();
    rainGauge.begin();
    alarmOut.begin();
    connectWifi();
    mqtt.setServer(TB_HOST, TB_PORT);
    mqtt.setCallback(onMqttMessage);
}

void loop() {
    static uint32_t lastSample = 0;
    mqtt.loop();

    if (millis() - lastSample >= 1000) {
        lastSample = millis();
        station.sample();
        if (station.shouldReport()) {
            const auto t = station.buildTelemetry();
            if (mqtt.connected()) publishTelemetry(t);
            else bufferOffline(t);
            station.markReported();
            updateLcd(t);
        }
    }
    // TODO: tự kết nối lại WiFi/MQTT có backoff, watchdog (esp_task_wdt)
}

void connectWifi() {}
bool loadAccessToken(String&) { return false; }
bool provisionDevice(String&) { return false; }
bool connectMqtt(const String&) { return false; }
void publishTelemetry(const flood::Telemetry&) {}
void bufferOffline(const flood::Telemetry&) {}
void flushOfflineBuffer() {}
void onMqttMessage(char*, byte*, unsigned int) {}
void handleRpc(const char*, const char*, JsonVariantConst) {}
void applySharedAttributes(JsonVariantConst) {}
void updateLcd(const flood::Telemetry&) {}
