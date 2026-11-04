#pragma once
// TODO: chuyển sang WiFiManager/NVS thay vì hard-code.
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASS ""
#define TB_HOST "thingsboard.local"
#define TB_PORT 1883
#define DEVICE_ID "VN-HCM-001"

// Chân GPIO (khớp diagram.json của Wokwi)
#define PIN_US_TRIG 5
#define PIN_US_ECHO 18
#define PIN_RAIN_TIP 19
#define PIN_I2C_SDA 21  // LCD1602 I2C (PCF8574, 0x27)
#define PIN_I2C_SCL 22
#define LCD_I2C_ADDR 0x27
#define PIN_LED_GREEN 25
#define PIN_LED_YELLOW 26
#define PIN_LED_RED 27
#define PIN_BUZZER 14
