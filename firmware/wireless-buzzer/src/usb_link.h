#pragma once

#include <Arduino.h>

/**
 * The serial connection over the Feather's USB serial chip (CH9102), only while USB is plugged in.
 *
 * Without USB the chip has no power. If the ESP32 kept driving its serial output (TX, GPIO 1) high then, the chip would
 * be powered through it, halfway, and wouldn't show up on the computer when USB is plugged in. So the ESP32 leaves TX
 * alone until the chip has power, which it sees on RX (GPIO 3): the chip's output idles high, an unpowered one reads
 * low against the pull-down.
 */
class UsbLink {
public:
    /** Releases TX and looks for USB right away, so that the log starts with the buzzer when it is plugged in */
    void begin();
    /** True once when USB was plugged in and Serial started */
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

    void connect();
    void disconnect();
};
