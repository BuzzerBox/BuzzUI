// The wireless buzzer: sleeps until its button is pressed, then connects to the BuzzerBox's WiFi and game server, and
// stays awake while a game is running. Plugged into the box over USB, it gets the box's WiFi. See README.md.

#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <driver/rtc_io.h>
#include <esp_sleep.h>
#include <esp_timer.h>

#include "button.h"
#include "clock_sync.h"
#include "config.h"
#include "indicator.h"
#include "messages.h"
#include "power_policy.h"
#include "usb_link.h"

// kept through deep sleep (but not when the power was off): the access point of the last connection, for a quicker one
RTC_DATA_ATTR static int32_t lastChannel = 0;
RTC_DATA_ATTR static uint8_t lastBssid[6];
// the server takes a press number once, so they go on counting after a sleep
RTC_DATA_ATTR static uint32_t pressNumber = 0;

// the Feather's button and the big one
static Button button;
static Button externalButton;
static Indicator indicator;
// Serial only while USB is plugged in, see UsbLink
static UsbLink usb;
static ClockSync clockSync;
static PowerPolicy policy({CONNECT_TIMEOUT_MS, CONTACT_TIMEOUT_MS, LOST_TIMEOUT_MS, IDLE_TIMEOUT_MS});
static WiFiUDP udp;

static messages::WifiSettings wifi;
static bool hasWifi = false;
static char mac[18];
// the last STATE of the server
static messages::State serverState;

// the WiFi connection
static bool connected = false;
static bool fastConnecting = false;
static uint32_t connectStartMs = 0;
static IPAddress serverIp;

static uint32_t heartbeatSeq = 0;
static uint32_t lastHeartbeatMs = 0;
static uint16_t batteryMv = 0;
static uint32_t lastBatteryMs = 0;

// the press that is sent until the server acknowledges it
static struct {
    bool active;
    uint32_t number;
    bool hasServerTime;
    int64_t serverUs;
    int sends;
    uint32_t lastSendMs;
} press = {};

static char line[320];
static size_t lineLength = 0;
// the rest of a line that was too long is skipped
static bool skippingLine = false;

// sent with the heartbeats, see messages::Diagnostics
static const char *resetReason = "";
static uint32_t wifiDrops = 0;
// set by the WiFi task
static volatile uint8_t lastWifiReason = 0;

static const char *describeResetReason(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_POWERON: return "POWERON";
        case ESP_RST_EXT: return "EXT";
        case ESP_RST_SW: return "SW";
        case ESP_RST_PANIC: return "PANIC";
        case ESP_RST_INT_WDT: return "INT_WDT";
        case ESP_RST_TASK_WDT: return "TASK_WDT";
        case ESP_RST_WDT: return "WDT";
        case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
        case ESP_RST_BROWNOUT: return "BROWNOUT";
        case ESP_RST_SDIO: return "SDIO";
        default: return "UNKNOWN";
    }
}

// ----- WiFi settings and the color of the case, in the flash

static void loadWifi() {
    Preferences prefs;
    // read-write: read-only fails (and logs an error) while the namespace doesn't exist yet
    prefs.begin("buzzer", false);
    // a buzzer that never got the WiFi has no keys, and reading a missing one logs an error
    if (prefs.isKey("ssid")) {
        prefs.getString("ssid", wifi.ssid, sizeof(wifi.ssid));
        prefs.getString("pass", wifi.passphrase, sizeof(wifi.passphrase));
        prefs.getString("host", wifi.host, sizeof(wifi.host));
        wifi.port = prefs.getUShort("port", 0);
    }
    if (prefs.isKey("color")) {
        prefs.getString("color", wifi.color, sizeof(wifi.color));
    }
    prefs.end();
    hasWifi = wifi.ssid[0] != '\0' && wifi.host[0] != '\0' && wifi.port != 0;
}

static void saveWifi() {
    Preferences prefs;
    prefs.begin("buzzer", false);
    prefs.putString("ssid", wifi.ssid);
    prefs.putString("pass", wifi.passphrase);
    prefs.putString("host", wifi.host);
    prefs.putUShort("port", wifi.port);
    prefs.putString("color", wifi.color);
    prefs.end();
}

// ----- network

static void connectWifi(bool fast) {
    connected = false;
    udp.stop();
    WiFi.disconnect();
    fastConnecting = fast && lastChannel > 0;
    if (fastConnecting) {
        WiFi.begin(wifi.ssid, wifi.passphrase, lastChannel, lastBssid);
    } else {
        WiFi.begin(wifi.ssid, wifi.passphrase);
    }
    connectStartMs = millis();
}

static void onConnected() {
    connected = true;
    fastConnecting = false;
    lastChannel = WiFi.channel();
    memcpy(lastBssid, WiFi.BSSID(), sizeof(lastBssid));
    if (!serverIp.fromString(wifi.host) && !WiFi.hostByName(wifi.host, serverIp)) {
        Serial.printf("Can't resolve the server %s\n", wifi.host);
    }
    udp.begin(LOCAL_PORT);
    Serial.printf("Connected to %s as %s, server %s:%u\n", wifi.ssid, WiFi.localIP().toString().c_str(),
                  serverIp.toString().c_str(), wifi.port);
    // right away, not in a second
    lastHeartbeatMs = millis() - HEARTBEAT_INTERVAL_MS;
}

static void sendPacket(const char *packet, size_t length) {
    if (!connected || length == 0 || (uint32_t) serverIp == 0) {
        return;
    }
    udp.beginPacket(serverIp, wifi.port);
    udp.write((const uint8_t *) packet, length);
    udp.endPacket();
}

static void sendHeartbeat() {
    char packet[256];
    heartbeatSeq++;
    messages::Diagnostics diagnostics;
    diagnostics.resetReason = resetReason;
    diagnostics.uptimeS = millis() / 1000;
    diagnostics.wifiDrops = wifiDrops;
    diagnostics.lastWifiReason = lastWifiReason;
    size_t length = messages::buildHeartbeat(packet, sizeof(packet), mac, LOCAL_PORT, heartbeatSeq, batteryMv,
                                             FIRMWARE_VERSION, diagnostics, wifi.color);
    clockSync.onSent(heartbeatSeq, esp_timer_get_time());
    sendPacket(packet, length);
}

static void sendPress() {
    char packet[160];
    size_t length = messages::buildPress(packet, sizeof(packet), mac, press.number, press.hasServerTime,
                                         press.serverUs);
    sendPacket(packet, length);
    press.sends++;
    press.lastSendMs = millis();
}

static void receivePackets() {
    char packet[300];
    while (udp.parsePacket() > 0) {
        int length = udp.read(packet, sizeof(packet) - 1);
        int64_t nowUs = esp_timer_get_time();
        if (length <= 0) {
            continue;
        }
        // anything on the WiFi can send here; only the server says what the buzzer shows
        if (!(udp.remoteIP() == serverIp)) {
            Serial.printf("Ignoring a packet from %s, not the server\n", udp.remoteIP().toString().c_str());
            continue;
        }
        packet[length] = '\0';
        messages::State state;
        if (!messages::parseState(packet, length, state)) {
            Serial.printf("Ignoring a packet from %s: %s\n", udp.remoteIP().toString().c_str(), packet);
            continue;
        }
        if (state.hasAck) {
            clockSync.onAnswer(state.ack, state.serverUs, nowUs);
        }
        if (state.hasPressAck && press.active && state.pressAck == press.number) {
            press.active = false;
            Serial.printf("The server got press %u after %d sends\n", press.number, press.sends);
        }
        serverState = state;
        policy.onState(millis(), state.game);
    }
}

// ----- USB: the box gives the WiFi, see BuzzUI server/services/buzzer-provisioning.service.ts

static void printReady() {
    // which WiFi it has, so that the box can tell whether it is adopted already, and its color
    char wifiInfo[240];
    if (messages::buildWifiInfo(wifiInfo, sizeof(wifiInfo), hasWifi, wifi) == 0) {
        strcpy(wifiInfo, "{}");
    }
    Serial.printf("BUZZ READY %s %s %s\n", mac, FIRMWARE_VERSION, wifiInfo);
}

static void onLine(const char *text) {
    static const char WIFI_PREFIX[] = "BUZZ WIFI ";
    if (strcmp(text, "BUZZ HELLO") == 0) {
        policy.onActivity(millis());
        printReady();
    } else if (strncmp(text, WIFI_PREFIX, sizeof(WIFI_PREFIX) - 1) == 0) {
        policy.onActivity(millis());
        messages::WifiSettings received;
        if (!messages::parseWifi(text + sizeof(WIFI_PREFIX) - 1, received)) {
            Serial.println("BUZZ ERROR invalid WiFi settings");
            indicator.flash(255, 0, 0, 3);
            return;
        }
        if (!received.hasColor) {
            strcpy(received.color, wifi.color);
        }
        bool changed = strcmp(received.ssid, wifi.ssid) != 0 || strcmp(received.passphrase, wifi.passphrase) != 0
            || strcmp(received.host, wifi.host) != 0 || received.port != wifi.port;
        bool colorChanged = strcmp(received.color, wifi.color) != 0;
        wifi = received;
        hasWifi = true;
        if (changed || colorChanged) {
            saveWifi();
        }
        if (changed) {
            // another network, another access point
            lastChannel = 0;
            clockSync.reset();
            connectWifi(false);
        }
        Serial.println("BUZZ OK");
        indicator.flash(0, 255, 0, 3);
    }
}

static void readSerial() {
    while (Serial.available() > 0) {
        char c = (char) Serial.read();
        if (c == '\n') {
            if (!skippingLine) {
                line[lineLength] = '\0';
                onLine(line);
            }
            lineLength = 0;
            skippingLine = false;
        } else if (c != '\r' && !skippingLine) {
            if (lineLength < sizeof(line) - 1) {
                line[lineLength++] = c;
            } else {
                // too long for anything it knows; skip to the next line
                lineLength = 0;
                skippingLine = true;
            }
        }
    }
}

// ----- power

static uint16_t readBattery() {
    uint32_t sum = 0;
    for (int i = 0; i < 8; i++) {
        sum += analogReadMilliVolts(BATTERY_PIN);
    }
    // the divider halves the voltage
    return (uint16_t) (sum / 8 * 2);
}

static void goToSleep() {
    Serial.println("Going to sleep, press the button to wake up");
    indicator.shutdown();
    udp.stop();
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    // a button that is still held would wake the buzzer right away. One held for longer is stuck (or its wires touch):
    // then it wakes the buzzer when it is released, so it can't keep the buzzer awake and empty the battery.
    bool hasExternalButton = EXTERNAL_BUTTON_PIN != GPIO_NUM_NC;
    uint32_t waitStartMs = millis();
    while ((button.isDown() || (hasExternalButton && externalButton.isDown()))
           && millis() - waitStartMs < HELD_BUTTON_WAIT_MS) {
        delay(10);
    }
    bool buttonHeld = button.isDown();
    bool externalButtonHeld = hasExternalButton && externalButton.isDown();
    if (buttonHeld || externalButtonHeld) {
        Serial.println("A button is stuck, it wakes the buzzer when it is released");
    }
    // the pull-ups of the RTC GPIOs need the RTC peripherals powered while asleep
    esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_ON);
    for (gpio_num_t pin : {BUTTON_PIN, EXTERNAL_BUTTON_PIN}) {
        if (pin != GPIO_NUM_NC && pin < GPIO_NUM_34) {
            rtc_gpio_pullup_en(pin);
            rtc_gpio_pulldown_dis(pin);
        }
    }
    // ext0 wakes up on one pin, ext1 on a set of pins that are all low (or any high): here the other one
    esp_sleep_enable_ext0_wakeup(BUTTON_PIN, buttonHeld ? 1 : 0);
    if (hasExternalButton) {
        esp_sleep_enable_ext1_wakeup(1ULL << EXTERNAL_BUTTON_PIN,
                                     externalButtonHeld ? ESP_EXT1_WAKEUP_ANY_HIGH : ESP_EXT1_WAKEUP_ALL_LOW);
    }
    usb.end();
    esp_deep_sleep_start();
}

static void logConnection(uint32_t nowMs) {
    static PowerPolicy::Connection logged = PowerPolicy::Connection::CONNECTING;
    PowerPolicy::Connection connection = policy.connection(nowMs);
    if (connection == logged) {
        return;
    }
    logged = connection;
    if (connection == PowerPolicy::Connection::ONLINE) {
        Serial.printf("The server answers (game: %s, clock synchronized to %lld µs)\n", serverState.game ? "yes" : "no",
                      clockSync.accuracyUs());
    } else if (connection == PowerPolicy::Connection::LOST) {
        Serial.println("The server stopped answering");
    }
}

static void updateIndicator(uint32_t nowMs) {
    Indicator::Pattern pattern;
    if (!hasWifi) {
        pattern = Indicator::Pattern::NO_WIFI;
    } else {
        switch (policy.connection(nowMs)) {
            case PowerPolicy::Connection::CONNECTING:
                pattern = Indicator::Pattern::CONNECTING;
                break;
            case PowerPolicy::Connection::LOST:
                pattern = Indicator::Pattern::LOST;
                break;
            case PowerPolicy::Connection::ONLINE:
            default:
                if (!serverState.game) {
                    pattern = Indicator::Pattern::IDLE;
                } else if (serverState.selected) {
                    pattern = Indicator::Pattern::SELECTED;
                } else if (serverState.locked) {
                    pattern = Indicator::Pattern::LOCKED;
                } else {
                    pattern = Indicator::Pattern::READY;
                }
        }
    }
    indicator.setPattern(pattern);
    indicator.setBatteryLow(batteryMv > 0 && batteryMv < BATTERY_LOW_MV);
    indicator.update(nowMs);
}

// -----

void setup() {
    usb.begin();
    indicator.begin();
    button.begin(BUTTON_PIN, DEBOUNCE_MS);
    if (EXTERNAL_BUTTON_PIN != GPIO_NUM_NC) {
        externalButton.begin(EXTERNAL_BUTTON_PIN, DEBOUNCE_MS);
    }
    if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_UNDEFINED) {
        // the power was off, so the RTC memory is new
        lastChannel = 0;
        pressNumber = esp_random();
    }
    resetReason = describeResetReason(esp_reset_reason());
    Serial.printf("Started: %s\n", resetReason);
    WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
        lastWifiReason = info.wifi_sta_disconnected.reason;
    }, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    // without power saving, packets go out right away
    WiFi.setSleep(false);
    WiFi.setAutoReconnect(true);
    snprintf(mac, sizeof(mac), "%s", WiFi.macAddress().c_str());
    // before BUZZ READY, which tells the box the WiFi the buzzer has
    loadWifi();
    printReady();

    policy.onWake(millis());
    batteryMv = readBattery();
    lastBatteryMs = millis();
    if (hasWifi) {
        connectWifi(true);
    } else {
        Serial.println("No WiFi yet, plug the buzzer into the BuzzerBox over USB");
    }
}

void loop() {
    uint32_t nowMs = millis();
    if (usb.poll(nowMs)) {
        // the box greets a buzzer that shows up; it answers right away
        printReady();
        Serial.printf("Started: %s, %s\n", resetReason, hasWifi ? wifi.ssid : "no WiFi yet");
    }
    readSerial();

    if (hasWifi) {
        bool isConnected = WiFi.status() == WL_CONNECTED;
        uint32_t connectTimeoutMs = fastConnecting ? FAST_CONNECT_TIMEOUT_MS : RECONNECT_TIMEOUT_MS;
        if (isConnected && !connected) {
            onConnected();
        } else if (!isConnected && connected) {
            connected = false;
            wifiDrops++;
            // the core may reconnect by itself; if it doesn't, see below
            connectStartMs = nowMs;
            Serial.printf("WiFi lost (reason %u)\n", lastWifiReason);
        } else if (!isConnected && nowMs - connectStartMs > connectTimeoutMs) {
            // the access point changed (so scan), or it went away and the core doesn't try again (so start over)
            Serial.println("Not connected, looking for the WiFi again");
            connectWifi(false);
        }
    }

    if (connected) {
        receivePackets();
        if (nowMs - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
            lastHeartbeatMs = nowMs;
            sendHeartbeat();
        }
    }

    int64_t pressedUs;
    // both are polled, so that each one tracks its own release
    bool pressed = button.poll(pressedUs);
    int64_t externalPressedUs;
    if (EXTERNAL_BUTTON_PIN != GPIO_NUM_NC && externalButton.poll(externalPressedUs)) {
        pressedUs = pressed ? min(pressedUs, externalPressedUs) : externalPressedUs;
        pressed = true;
    }
    if (pressed) {
        policy.onActivity(nowMs);
        press = {true, ++pressNumber, clockSync.isSynced(), clockSync.toServer(pressedUs), 0, 0};
        sendPress();
        Serial.printf("Pressed, sent press %u%s\n", press.number, connected ? "" : " (but there is no WiFi)");
    } else if (press.active && nowMs - press.lastSendMs >= PRESS_RESEND_INTERVAL_MS) {
        if (press.sends < PRESS_SENDS) {
            sendPress();
        } else {
            press.active = false;
            Serial.printf("The server didn't acknowledge press %u\n", press.number);
        }
    }

    if (nowMs - lastBatteryMs >= 30000) {
        lastBatteryMs = nowMs;
        batteryMv = readBattery();
    }

    logConnection(nowMs);
    updateIndicator(nowMs);
    if (policy.shouldSleep(nowMs)) {
        goToSleep();
    }
    delay(1);
}
