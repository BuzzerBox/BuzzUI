// The wireless buzzer: sleeps until its button is pressed, then connects to the BuzzerBox's WiFi and game server, and
// stays awake while a game is running. Plugged into the box over USB, it gets the box's WiFi, and the game goes over
// USB until it is unplugged (UsbMode). See README.md.

#include <Arduino.h>
#include <stdarg.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <driver/rtc_io.h>
#include <esp_sleep.h>
#include <esp_timer.h>

#include "battery.h"
#include "button.h"
#include "clock_sync.h"
#include "config.h"
#include "indicator.h"
#include "messages.h"
#include "power_policy.h"
#include "usb_link.h"
#include "usb_mode.h"

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
static Battery battery;
static ClockSync clockSync;
static PowerPolicy policy({CONNECT_TIMEOUT_MS, CONTACT_TIMEOUT_MS, LOST_TIMEOUT_MS, IDLE_TIMEOUT_MS});
static WiFiUDP udp;
static UsbMode usbMode({USB_CONTACT_TIMEOUT_MS});

// The log, over USB while it is plugged in. A line that doesn't fit is dropped, see UsbLink::write().
static void logLine(const char *format, ...) {
    char text[256];
    va_list args;
    va_start(args, format);
    int length = vsnprintf(text, sizeof(text), format, args);
    va_end(args);
    if (length > 0) {
        usb.write(text, length < (int) sizeof(text) ? length : sizeof(text) - 1, USB_WRITE_TIMEOUT_MS);
    }
}

// A line of the protocol with the box. It starts with a newline as well, so that the box finds its start after a log
// line that was cut off.
static bool sendLine(const char *text) {
    char line[384];
    int length = snprintf(line, sizeof(line), "\n%s\n", text);
    return length > 0 && length < (int) sizeof(line) && usb.write(line, length, USB_WRITE_TIMEOUT_MS);
}

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
// of the last heartbeat over the WiFi while the game goes over USB
static uint32_t lastStandbyHeartbeatMs = 0;
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
// when the first character of the line came, for the clock (see onState)
static int64_t lineStartUs = 0;
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
        logLine("Can't resolve the server %s\n", wifi.host);
    }
    udp.begin(LOCAL_PORT);
    logLine("Connected to %s as %s, server %s:%u\n", wifi.ssid, WiFi.localIP().toString().c_str(),
                  serverIp.toString().c_str(), wifi.port);
    // right away, not in a second
    lastHeartbeatMs = millis() - HEARTBEAT_INTERVAL_MS;
}

// how a packet goes to the server
enum class Link { WIFI, USB };

// false if it couldn't be sent
static bool sendPacket(Link link, const char *packet, size_t length) {
    if (length == 0) {
        return false;
    }
    if (link == Link::USB) {
        // the same JSON as over UDP, as a line among the log (BuzzerProvisioningService in server/services/buzzer-provisioning.service.ts)
        char text[300];
        if (length + 10 > sizeof(text)) {
            return false;
        }
        memcpy(text, "BUZZ PKT ", 9);
        memcpy(text + 9, packet, length);
        text[9 + length] = '\0';
        return sendLine(text);
    }
    if (!connected || (uint32_t) serverIp == 0) {
        return false;
    }
    udp.beginPacket(serverIp, wifi.port);
    udp.write((const uint8_t *) packet, length);
    return udp.endPacket() == 1;
}

static void sendHeartbeat(Link link) {
    char packet[256];
    heartbeatSeq++;
    messages::Diagnostics diagnostics;
    diagnostics.resetReason = resetReason;
    diagnostics.uptimeS = millis() / 1000;
    diagnostics.wifiDrops = wifiDrops;
    diagnostics.lastWifiReason = lastWifiReason;
    size_t length = messages::buildHeartbeat(packet, sizeof(packet), mac, LOCAL_PORT, heartbeatSeq,
                                             battery.millivolts(), FIRMWARE_VERSION, diagnostics, wifi.color,
                                             battery.percent());
    if (link == Link::USB) {
        // At 115200 baud the line takes about 20 ms, while the server's answer is shorter. Taking the time once it went
        // out (and the answer's when its first character comes, see readSerial) keeps the round trip even, which the
        // clock takes for granted.
        if (sendPacket(link, packet, length)) {
            // the Feather V2's UART sends the rest of its buffer meanwhile; the S3 sends right away
            Serial.flush();
            clockSync.onSent(heartbeatSeq, esp_timer_get_time());
        }
    } else {
        clockSync.onSent(heartbeatSeq, esp_timer_get_time());
        sendPacket(link, packet, length);
    }
}

static void sendPress() {
    char packet[160];
    size_t length = messages::buildPress(packet, sizeof(packet), mac, press.number, press.hasServerTime,
                                         press.serverUs);
    if (usbMode.isLinked()) {
        sendPacket(Link::USB, packet, length);
    }
    if (UsbMode::sendsPressOverWifi(usbMode.isLinked(), press.sends, PRESS_USB_ONLY_SENDS)) {
        sendPacket(Link::WIFI, packet, length);
    }
    press.sends++;
    press.lastSendMs = millis();
}

// a STATE of the server, over the WiFi or over USB
static void onState(const messages::State &state, int64_t receivedUs) {
    if (state.hasAck) {
        clockSync.onAnswer(state.ack, state.serverUs, receivedUs);
    }
    if (state.hasPressAck && press.active && state.pressAck == press.number) {
        press.active = false;
        logLine("The server got press %u after %d sends\n", press.number, press.sends);
    }
    serverState = state;
    policy.onState(millis(), state.game);
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
            logLine("Ignoring a packet from %s, not the server\n", udp.remoteIP().toString().c_str());
            continue;
        }
        packet[length] = '\0';
        messages::State state;
        if (!messages::parseState(packet, length, state)) {
            logLine("Ignoring a packet from %s: %s\n", udp.remoteIP().toString().c_str(), packet);
            continue;
        }
        onState(state, nowUs);
    }
}

// ----- USB: the box gives the WiFi, and the game goes over USB while the box talks to the buzzer there (UsbMode), see
// server/services/buzzer-provisioning.service.ts

static void printReady() {
    // which WiFi it has, so that the box can tell whether it is adopted already, and its color
    char wifiInfo[240];
    if (messages::buildWifiInfo(wifiInfo, sizeof(wifiInfo), hasWifi, wifi) == 0) {
        strcpy(wifiInfo, "{}");
    }
    char text[300];
    snprintf(text, sizeof(text), "BUZZ READY %s %s %s", mac, FIRMWARE_VERSION, wifiInfo);
    sendLine(text);
}

static void onLine(const char *text, int64_t startUs) {
    static const char WIFI_PREFIX[] = "BUZZ WIFI ";
    static const char PACKET_PREFIX[] = "BUZZ PKT ";
    if (strncmp(text, PACKET_PREFIX, sizeof(PACKET_PREFIX) - 1) == 0) {
        const char *json = text + sizeof(PACKET_PREFIX) - 1;
        messages::State state;
        if (messages::parseState(json, strlen(json), state)) {
            usbMode.onContact(millis());
            onState(state, startUs);
        } else {
            logLine("Ignoring a packet over USB: %s\n", json);
        }
    } else if (strcmp(text, "BUZZ LINK") == 0) {
        usbMode.onContact(millis());
    } else if (strcmp(text, "BUZZ HELLO") == 0) {
        policy.onActivity(millis());
        printReady();
    } else if (strncmp(text, WIFI_PREFIX, sizeof(WIFI_PREFIX) - 1) == 0) {
        policy.onActivity(millis());
        messages::WifiSettings received;
        if (!messages::parseWifi(text + sizeof(WIFI_PREFIX) - 1, received)) {
            sendLine("BUZZ ERROR invalid WiFi settings");
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
        sendLine("BUZZ OK");
        indicator.flash(0, 255, 0, 3);
    }
}

static void readSerial() {
    while (Serial.available() > 0) {
        char c = (char) Serial.read();
        if (c == '\n') {
            if (!skippingLine) {
                line[lineLength] = '\0';
                onLine(line, lineStartUs);
            }
            lineLength = 0;
            skippingLine = false;
        } else if (c != '\r' && !skippingLine) {
            if (lineLength == 0) {
                lineStartUs = esp_timer_get_time();
            }
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

static void goToSleep() {
    logLine("Going to sleep, press the button to wake up\n");
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
        logLine("A button is stuck, it wakes the buzzer when it is released\n");
    }
    // the pull-ups of the RTC GPIOs need the RTC peripherals powered while asleep
    esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_ON);
    for (gpio_num_t pin : {BUTTON_PIN, EXTERNAL_BUTTON_PIN}) {
        if (hasPullUp(pin)) {
            rtc_gpio_pullup_en(pin);
            rtc_gpio_pulldown_dis(pin);
        }
    }
    // ext0 wakes up on one pin, ext1 on a set of pins that are all low (the ESP32-S3: any low; the same for one pin) or
    // any high: here the other one
    esp_sleep_enable_ext0_wakeup(BUTTON_PIN, buttonHeld ? 1 : 0);
    if (hasExternalButton) {
#if CONFIG_IDF_TARGET_ESP32S3
        const esp_sleep_ext1_wakeup_mode_t lowMode = ESP_EXT1_WAKEUP_ANY_LOW;
#else
        const esp_sleep_ext1_wakeup_mode_t lowMode = ESP_EXT1_WAKEUP_ALL_LOW;
#endif
        esp_sleep_enable_ext1_wakeup(1ULL << EXTERNAL_BUTTON_PIN,
                                     externalButtonHeld ? ESP_EXT1_WAKEUP_ANY_HIGH : lowMode);
    }
    battery.end();
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
        logLine("The server answers (game: %s, clock synchronized to %lld µs)\n", serverState.game ? "yes" : "no",
                      clockSync.accuracyUs());
    } else if (connection == PowerPolicy::Connection::LOST) {
        logLine("The server stopped answering\n");
    }
}

static void updateIndicator(uint32_t nowMs) {
    Indicator::Pattern pattern;
    // over USB a buzzer plays without the WiFi too
    if (!hasWifi && !usbMode.isLinked()) {
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
    indicator.setBatteryLow(battery.millivolts() > 0 && battery.millivolts() < BATTERY_LOW_MV);
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
    logLine("Started: %s\n", resetReason);
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
    battery.begin();
    lastBatteryMs = millis();
    if (hasWifi) {
        connectWifi(true);
    } else {
        logLine("No WiFi yet, plug the buzzer into the BuzzerBox over USB\n");
    }
}

void loop() {
    uint32_t nowMs = millis();
    if (usb.poll(nowMs)) {
        // the box greets a buzzer that shows up; it answers right away
        printReady();
        logLine("Started: %s, %s\n", resetReason, hasWifi ? wifi.ssid : "no WiFi yet");
    }
    readSerial();
    switch (usbMode.update(nowMs, usb.isConnected())) {
        case UsbMode::Change::TO_USB:
            logLine("Playing over USB\n");
            // right away, not in a second
            lastHeartbeatMs = nowMs - HEARTBEAT_INTERVAL_MS;
            lastStandbyHeartbeatMs = nowMs;
            break;
        case UsbMode::Change::TO_WIFI:
            logLine("Playing over WiFi%s\n", connected ? "" : " (once it is connected)");
            lastHeartbeatMs = nowMs - HEARTBEAT_INTERVAL_MS;
            break;
        case UsbMode::Change::NONE:
        default:
            break;
    }
    // the box powers a buzzer that plays over USB, which is ready for a game then
    policy.setPluggedIn(nowMs, (STAY_AWAKE_ON_USB && usb.isConnected()) || usbMode.isLinked());

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
            logLine("WiFi lost (reason %u)\n", lastWifiReason);
        } else if (!isConnected && nowMs - connectStartMs > connectTimeoutMs) {
            // the access point changed (so scan), or it went away and the core doesn't try again (so start over)
            logLine("Not connected, looking for the WiFi again\n");
            connectWifi(false);
        }
    }

    if (connected) {
        receivePackets();
    }
    if (usbMode.isLinked()) {
        if (nowMs - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
            lastHeartbeatMs = nowMs;
            sendHeartbeat(Link::USB);
        }
        if (connected && nowMs - lastStandbyHeartbeatMs >= STANDBY_HEARTBEAT_INTERVAL_MS) {
            lastStandbyHeartbeatMs = nowMs;
            sendHeartbeat(Link::WIFI);
        }
    } else if (connected && nowMs - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatMs = nowMs;
        sendHeartbeat(Link::WIFI);
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
        logLine("Pressed, sent press %u %s\n", press.number,
                      usbMode.isLinked() ? "over USB" : connected ? "over WiFi" : "(but there is no WiFi)");
    } else if (press.active && nowMs - press.lastSendMs >= PRESS_RESEND_INTERVAL_MS) {
        if (press.sends < PRESS_SENDS) {
            sendPress();
        } else {
            press.active = false;
            logLine("The server didn't acknowledge press %u\n", press.number);
        }
    }

    if (nowMs - lastBatteryMs >= 30000) {
        lastBatteryMs = nowMs;
        battery.update();
    }

    logConnection(nowMs);
    updateIndicator(nowMs);
    if (policy.shouldSleep(nowMs)) {
        goToSleep();
    }
    delay(1);
}
