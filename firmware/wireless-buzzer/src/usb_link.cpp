#include "usb_link.h"

bool UsbLink::write(const char *data, size_t length, uint32_t timeoutMs) {
    if (!connected) {
        return false;
    }
    uint32_t startMs = millis();
    size_t written = 0;
    while (written < length) {
        int room = Serial.availableForWrite();
        if (room <= 0) {
            // starts sending what is in the buffer, as the core's write() does while it waits; on the S3 nothing else
            // may, and the buffer would stay full
            Serial.flush();
            if (stalled || millis() - startMs >= timeoutMs) {
                stalled = true;
                return false;
            }
            // the USB task (S3) or the UART sends meanwhile
            delay(1);
            continue;
        }
        size_t chunk = length - written < (size_t) room ? length - written : (size_t) room;
        size_t sent = Serial.write((const uint8_t *) data + written, chunk);
        if (sent == 0) {
            stalled = true;
            return false;
        }
        written += sent;
    }
    Serial.flush();
    stalled = false;
    return true;
}

#if CONFIG_IDF_TARGET_ESP32S3

#include <USB.h>

void UsbLink::begin() {
    // with ARDUINO_USB_CDC_ON_BOOT the core starts USB; this only sets up Serial. A line to a closed port is dropped
    // right away, nothing waits for it.
    Serial.begin(115200);
    connected = (bool) USB;
}

bool UsbLink::poll(uint32_t nowMs) {
    connected = (bool) USB;
    // the DTR and RTS that opening the port raises
    bool open = (bool) Serial;
    bool opened = open && !portOpen;
    portOpen = open;
    return opened;
}

void UsbLink::end() {
    Serial.flush();
}

#else

#include <driver/gpio.h>

static const gpio_num_t TX_PIN = GPIO_NUM_1;
static const gpio_num_t RX_PIN = GPIO_NUM_3;
static const uint32_t CHECK_INTERVAL_MS = 250;
static const int HIGH_CHECKS_TO_CONNECT = 2;
// a byte at 115200 baud keeps RX low for less than 0.1 ms
static const uint32_t LOW_TO_DISCONNECT_MS = 500;

static void releaseTx() {
    // after a start, GPIO 1 is the UART's output and idles high
    pinMode(TX_PIN, INPUT);
}

static bool isRxHigh() {
    return gpio_get_level(RX_PIN) == 1;
}

void UsbLink::begin() {
    // A first Serial.begin() after releaseTx() sends nothing (Arduino core 2.0.17), one after Serial.end() works. So the
    // UART is started and ended once, before TX is released.
    Serial.begin(115200);
    Serial.end();
    releaseTx();
    pinMode(RX_PIN, INPUT_PULLDOWN);
    delayMicroseconds(100);
    if (isRxHigh()) {
        delay(10);
        if (isRxHigh()) {
            connect();
        }
    }
}

bool UsbLink::poll(uint32_t nowMs) {
    if (connected) {
        if (!isRxHigh()) {
            if (!rxLow) {
                rxLow = true;
                rxLowSinceMs = nowMs;
            } else if (nowMs - rxLowSinceMs >= LOW_TO_DISCONNECT_MS) {
                disconnect();
            }
        } else {
            rxLow = false;
        }
        return false;
    }
    if (nowMs - lastCheckMs < CHECK_INTERVAL_MS) {
        return false;
    }
    lastCheckMs = nowMs;
    highChecks = isRxHigh() ? highChecks + 1 : 0;
    if (highChecks < HIGH_CHECKS_TO_CONNECT) {
        return false;
    }
    connect();
    return true;
}

void UsbLink::connect() {
    Serial.begin(115200);
    // the UART leaves the pulls alone; the pull-down shows when the chip loses its power
    gpio_pullup_dis(RX_PIN);
    gpio_pulldown_en(RX_PIN);
    connected = true;
    rxLow = false;
    highChecks = 0;
}

void UsbLink::disconnect() {
    Serial.end();
    releaseTx();
    pinMode(RX_PIN, INPUT_PULLDOWN);
    connected = false;
}

void UsbLink::end() {
    if (connected) {
        Serial.flush();
        disconnect();
    }
}

#endif
