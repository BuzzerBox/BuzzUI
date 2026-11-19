#pragma once

#include <Arduino.h>

/**
 * The battery: on the Feather V2 its voltage through a divider, on the Feather ESP32-S3 the voltage and the charge from
 * the fuel gauge (MAX17048, I2C 0x36). Older Feather ESP32-S3 have an LC709203F instead, which isn't read: then the
 * buzzer tells no battery.
 */
class Battery {
public:
    void begin();
    /** Reads the battery again */
    void update();
    /** 0 if unknown */
    uint16_t millivolts() const { return mv; }
    /** 0-100 from a fuel gauge, or -1 without one */
    int percent() const { return pct; }
    /** Before deep sleep */
    void end();

private:
    uint16_t mv = 0;
    int pct = -1;
    bool hasGauge = false;
};
