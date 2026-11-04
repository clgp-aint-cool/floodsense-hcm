#include <chrono>
#include <iostream>
#include <mqtt/async_client.h>

#include "mqtt/transport.hpp"

namespace mqtt_io {

namespace {

constexpr auto kTimeout = std::chrono::seconds(10);

class PahoTransport : public ITransport {
public:
    bool connect(const ConnectParams& p) override {
        try {
            const std::string uri = "tcp://" + p.host + ":" + std::to_string(p.port);
            client_ = std::make_unique<mqtt::async_client>(uri, p.clientId);
            client_->set_message_callback([this](mqtt::const_message_ptr msg) {
                if (handler_) handler_(msg->get_topic(), msg->to_string());
            });
            auto opts = mqtt::connect_options_builder()
                            .user_name(p.username)
                            .keep_alive_interval(std::chrono::seconds(30))
                            .clean_session(true)
                            .finalize();
            return client_->connect(opts)->wait_for(kTimeout) && client_->is_connected();
        } catch (const mqtt::exception& e) {
            std::cerr << "[mqtt] connect " << p.clientId << ": " << e.what() << '\n';
            return false;
        }
    }

    void disconnect() override {
        try {
            if (client_ && client_->is_connected()) client_->disconnect()->wait_for(kTimeout);
        } catch (const mqtt::exception&) {
        }
    }

    bool isConnected() const override { return client_ && client_->is_connected(); }

    // QoS 1: chỉ coi là thành công khi nhận PUBACK.
    bool publish(const std::string& topic, const std::string& payload, int qos) override {
        try {
            return isConnected() && client_->publish(topic, payload, qos, false)->wait_for(kTimeout);
        } catch (const mqtt::exception& e) {
            std::cerr << "[mqtt] publish " << topic << ": " << e.what() << '\n';
            return false;
        }
    }

    bool subscribe(const std::string& topic, int qos) override {
        try {
            return isConnected() && client_->subscribe(topic, qos)->wait_for(kTimeout);
        } catch (const mqtt::exception& e) {
            std::cerr << "[mqtt] subscribe " << topic << ": " << e.what() << '\n';
            return false;
        }
    }

    void setMessageHandler(MessageHandler handler) override { handler_ = std::move(handler); }

    ~PahoTransport() override { disconnect(); }

private:
    std::unique_ptr<mqtt::async_client> client_;
    MessageHandler handler_;
};

}  // namespace

std::unique_ptr<ITransport> makePahoTransport() { return std::make_unique<PahoTransport>(); }

}  // namespace mqtt_io
