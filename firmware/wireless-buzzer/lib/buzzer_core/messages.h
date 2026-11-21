#pragma once

#include <stddef.h>
#include <stdint.h>

/**
 * The packets between the buzzer and the game server (BuzzUI server/services/udp-buzzer.service.ts), JSON over UDP:
 *
 *   buzzer → server  {"t":"HB","id":<MAC>,"lp":<port>,"seq":<n>,"bat":<mV>,"fw":<version>,           every second
 *                     "rr":<reset reason>,"up":<s awake>,"wd":<WiFi drops>,"wr":<last drop reason>,
 *                     "col":<color of the case, "#rrggbb">,"pct":<battery charge in %, from a fuel gauge>}
 *   buzzer → server  {"t":"PRESS","id":<MAC>,"n":<press number>,"ts":<µs on the server's clock>}
 *   server → buzzer  {"t":"STATE","selected":…,"locked":…,"game":…,"st":<server µs>,"ack":<seq>,"pa":<n>}
 *
 * and the WiFi the box gives it over USB (BuzzUI server/services/buzzer-provisioning.service.ts), where the buzzer
 * tells which WiFi it has: BUZZ READY <MAC> <firmware> {"ssid":…,"host":…,"port":…,"color":…}, or {} without one.
 * Never the passphrase. The box also tells the color of the buzzer's case ("color" in BUZZ WIFI), which the buzzer
 * keeps, so that it shows in that color on every box.
 */
namespace messages {

struct State {
    bool selected = false;
    bool locked = false;
    bool game = false;
    int64_t serverUs = 0;
    bool hasAck = false;
    uint32_t ack = 0;
    bool hasPressAck = false;
    uint32_t pressAck = 0;
};

/** What the server logs about the buzzer, to find out why it restarts or drops off */
struct Diagnostics {
    // why the ESP32 started last, e.g. "POWERON", "BROWNOUT", "PANIC"
    const char *resetReason = "";
    uint32_t uptimeS = 0;
    // how often the WiFi connection dropped since then, and the reason of the last drop (wifi_err_reason_t)
    uint32_t wifiDrops = 0;
    uint8_t lastWifiReason = 0;
};

struct WifiSettings {
    char ssid[33] = "";
    char passphrase[64] = "";
    char host[64] = "";
    uint16_t port = 0;
    // the color of the buzzer's case, "#rrggbb" in lower case, or "" if it wasn't told
    char color[8] = "";
    // parseWifi(): whether the line had a color; without one the buzzer keeps the one it has
    bool hasColor = false;
};

/**
 * The length of the packet, or 0 if it doesn't fit
 * @param batteryPercent the charge of the battery from a fuel gauge (0-100), or -1 without one
 */
size_t buildHeartbeat(char *out, size_t size, const char *mac, uint16_t listenPort, uint32_t seq, uint16_t batteryMv,
                      const char *firmwareVersion, const Diagnostics &diagnostics, const char *color = "",
                      int batteryPercent = -1);
/** Without a synchronized clock the time is left out; the server then takes the press after the others */
size_t buildPress(char *out, size_t size, const char *mac, uint32_t number, bool hasServerTime, int64_t serverUs);
bool parseState(const char *json, size_t length, State &state);
/** What the buzzer tells about its WiFi and color in the BUZZ READY line, without the passphrase; {} without either */
size_t buildWifiInfo(char *out, size_t size, bool hasWifi, const WifiSettings &settings);
/**
 * The JSON of a "BUZZ WIFI" line; false if something is missing or too long, or the color isn't "#rrggbb" (or "", which
 * takes it away)
 */
bool parseWifi(const char *json, WifiSettings &settings);

}
