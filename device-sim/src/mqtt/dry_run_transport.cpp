#include <iostream>
#include <mutex>

#include "mqtt/transport.hpp"

namespace mqtt_io {

namespace {

std::mutex gPrintMutex;

class DryRunTransport : public ITransport {
public:
    explicit DryRunTransport(bool verbose) : verbose_(verbose) {}

    bool connect(const ConnectParams& p) override {
        clientId_ = p.clientId;
        connected_ = true;
        return true;
    }
    void disconnect() override { connected_ = false; }
    bool isConnected() const override { return connected_; }

    bool publish(const std::string& topic, const std::string& payload, int) override {
        if (!connected_) return false;
        if (verbose_) {
            std::lock_guard<std::mutex> lock(gPrintMutex);
            std::cout << "[dry-run " << clientId_ << "] " << topic << " " << payload << '\n';
        }
        return true;
    }
    bool subscribe(const std::string&, int) override { return connected_; }
    void setMessageHandler(MessageHandler) override {}

private:
    bool verbose_;
    bool connected_ = false;
    std::string clientId_;
};

}  // namespace

std::unique_ptr<ITransport> makeDryRunTransport(bool verbose) {
    return std::make_unique<DryRunTransport>(verbose);
}

}  // namespace mqtt_io
