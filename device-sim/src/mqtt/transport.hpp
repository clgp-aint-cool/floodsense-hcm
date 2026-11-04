#pragma once

#include <functional>
#include <memory>
#include <string>

namespace mqtt_io {

struct ConnectParams {
    std::string host = "localhost";
    int port = 1883;
    std::string clientId;
    std::string username;  // ThingsBoard: access token, hoặc "provision"
};

using MessageHandler = std::function<void(const std::string& topic, const std::string& payload)>;

// Lớp trừu tượng MQTT để TbDevice không phụ thuộc thư viện cụ thể.
class ITransport {
public:
    virtual ~ITransport() = default;
    virtual bool connect(const ConnectParams& params) = 0;
    virtual void disconnect() = 0;
    virtual bool isConnected() const = 0;
    virtual bool publish(const std::string& topic, const std::string& payload, int qos = 1) = 0;
    virtual bool subscribe(const std::string& topic, int qos = 1) = 0;
    virtual void setMessageHandler(MessageHandler handler) = 0;
};

using TransportFactory = std::function<std::unique_ptr<ITransport>()>;

// In payload ra console thay vì gửi — dùng khi chưa dựng ThingsBoard.
std::unique_ptr<ITransport> makeDryRunTransport(bool verbose);
#ifdef FLOOD_SIM_WITH_MQTT
std::unique_ptr<ITransport> makePahoTransport();
#endif

}  // namespace mqtt_io
