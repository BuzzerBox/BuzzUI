#pragma once

#include <Arduino.h>

/**
 * The serial connection over USB, only while USB is plugged in.
 *
 * Feather V2: over its USB serial chip (CH9102). Without USB the chip has no power. If the ESP32 kept driving its
 * serial output (TX, GPIO 1) high then, the chip would be powered through it, halfway, and wouldn't show up on the
 * computer when USB is plugged in. So the ESP32 leaves TX alone until the chip has power, which it sees on RX (GPIO 3):
 * the chip's output idles high, an unpowered one reads low against the pull-down.
 *
 * Feather ESP32-S3: over the ESP32-S3's own USB (Serial is USB CDC). It counts as plugged in while a computer or the
 * box has the buzzer on USB (enumerated), not on a charger. Lines only go out while a program has the port open (DTR).
 */
class UsbLink {
public:
    /** Releases TX and looks for USB right away, so that the log starts with the buzzer when it is plugged in */
    void begin();
    /** True once when USB was plugged in and Serial started (on the S3: when a program opened the port) */
    bool poll(uint32_t nowMs);
    bool isConnected() const { return connected; }
    /** Before deep sleep */
    void end();

private:
    bool connected = false;
    uint32_t lastCheckMs = 0;
    // in a row, before it counts
    int highChecks = 0;
    // while connected: since when RX is low, which no serial byte keeps it for long
    bool rxLow = false;
    uint32_t rxLowSinceMs = 0;
    // S3: whether a program had the port open
    bool portOpen = false;

    void connect();
    void disconnect();
};
