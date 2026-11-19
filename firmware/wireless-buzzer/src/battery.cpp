#include "battery.h"

#include "config.h"

#if CONFIG_IDF_TARGET_ESP32S3

#include <Wire.h>

static const uint8_t GAUGE_ADDRESS = 0x36;
static const uint8_t REG_VCELL = 0x02;
static const uint8_t REG_SOC = 0x04;
static const uint8_t REG_VERSION = 0x08;

/** A 16-bit register of the MAX17048, high byte first; false if it didn't answer */
static bool readRegister(uint8_t reg, uint16_t &value) {
    Wire.beginTransmission(GAUGE_ADDRESS);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0 || Wire.requestFrom(GAUGE_ADDRESS, (uint8_t) 2) != 2) {
        return false;
    }
    value = (uint16_t) (Wire.read() << 8);
    value |= (uint16_t) Wire.read();
    return true;
}

void Battery::begin() {
    pinMode(I2C_POWER_PIN, OUTPUT);
    digitalWrite(I2C_POWER_PIN, HIGH);
    // the pull-ups need a moment
    delay(2);
    Wire.begin();
    uint16_t version;
    // the MAX17048 tells 0x001_
    hasGauge = readRegister(REG_VERSION, version) && (version & 0xFFF0) == 0x0010;
    if (!hasGauge) {
        Serial.println("No MAX17048 fuel gauge found, the battery is unknown");
    }
    update();
}

void Battery::update() {
    uint16_t vcell, soc;
    if (!hasGauge || !readRegister(REG_VCELL, vcell) || !readRegister(REG_SOC, soc)) {
        return;
    }
    // 78.125 µV per bit, and 1/256 % per bit
    mv = (uint16_t) ((uint32_t) vcell * 78125 / 1000000);
    pct = (soc + 128) >> 8;
}

void Battery::end() {
    Wire.end();
    digitalWrite(I2C_POWER_PIN, LOW);
}

#else

void Battery::begin() {
    update();
}

void Battery::update() {
    uint32_t sum = 0;
    for (int i = 0; i < 8; i++) {
        sum += analogReadMilliVolts(BATTERY_PIN);
    }
    // the divider halves the voltage
    mv = (uint16_t) (sum / 8 * 2);
}

void Battery::end() {
}

#endif
