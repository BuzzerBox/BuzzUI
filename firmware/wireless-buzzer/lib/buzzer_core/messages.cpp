#include "messages.h"

#include <string.h>
#include <ArduinoJson.h>

namespace messages {

static size_t serialize(const JsonDocument &doc, char *out, size_t size) {
    // measureJson() leaves out the terminating zero
    if (measureJson(doc) >= size) {
        return 0;
    }
    return serializeJson(doc, out, size);
}

size_t buildHeartbeat(char *out, size_t size, const char *mac, uint16_t listenPort, uint32_t seq, uint16_t batteryMv,
                      const char *firmwareVersion, const Diagnostics &diagnostics) {
    JsonDocument doc;
    doc["t"] = "HB";
    doc["id"] = mac;
    doc["lp"] = listenPort;
    doc["seq"] = seq;
    if (batteryMv > 0) {
        doc["bat"] = batteryMv;
    }
    doc["fw"] = firmwareVersion;
    doc["rr"] = diagnostics.resetReason;
    doc["up"] = diagnostics.uptimeS;
    doc["wd"] = diagnostics.wifiDrops;
    if (diagnostics.wifiDrops > 0) {
        doc["wr"] = diagnostics.lastWifiReason;
    }
    return serialize(doc, out, size);
}

size_t buildPress(char *out, size_t size, const char *mac, uint32_t number, bool hasServerTime, int64_t serverUs) {
    JsonDocument doc;
    doc["t"] = "PRESS";
    doc["id"] = mac;
    doc["n"] = number;
    if (hasServerTime) {
        doc["ts"] = serverUs;
    }
    return serialize(doc, out, size);
}

size_t buildWifiInfo(char *out, size_t size, bool hasWifi, const WifiSettings &settings) {
    JsonDocument doc;
    doc.to<JsonObject>();
    if (hasWifi) {
        doc["ssid"] = settings.ssid;
        doc["host"] = settings.host;
        doc["port"] = settings.port;
    }
    return serialize(doc, out, size);
}

bool parseState(const char *json, size_t length, State &state) {
    JsonDocument doc;
    if (deserializeJson(doc, json, length) != DeserializationError::Ok) {
        return false;
    }
    const char *type = doc["t"];
    if (type == nullptr || strcmp(type, "STATE") != 0) {
        return false;
    }
    state = State();
    state.selected = doc["selected"] | false;
    state.locked = doc["locked"] | false;
    state.game = doc["game"] | false;
    state.serverUs = doc["st"] | (int64_t) 0;
    state.hasAck = doc["ack"].is<uint32_t>();
    state.ack = doc["ack"] | 0u;
    state.hasPressAck = doc["pa"].is<uint32_t>();
    state.pressAck = doc["pa"] | 0u;
    return true;
}

static bool copy(const char *value, char *out, size_t size, size_t minLength) {
    if (value == nullptr) {
        return false;
    }
    size_t length = strlen(value);
    if (length < minLength || length >= size) {
        return false;
    }
    memcpy(out, value, length + 1);
    return true;
}

bool parseWifi(const char *json, WifiSettings &settings) {
    JsonDocument doc;
    if (deserializeJson(doc, json) != DeserializationError::Ok) {
        return false;
    }
    WifiSettings result;
    // WPA2 passphrases have 8-63 characters, SSIDs up to 32 bytes
    if (!copy(doc["ssid"], result.ssid, sizeof(result.ssid), 1)
        || !copy(doc["pass"], result.passphrase, sizeof(result.passphrase), 8)
        || !copy(doc["host"], result.host, sizeof(result.host), 1)) {
        return false;
    }
    uint32_t port = doc["port"] | 0u;
    if (port == 0 || port > 65535) {
        return false;
    }
    result.port = (uint16_t) port;
    settings = result;
    return true;
}

}
