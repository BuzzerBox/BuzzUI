#include "indicator.h"

#include "config.h"

static const uint32_t FLASH_PERIOD_MS = 300;
static const int LIGHT_CHANNEL = 0;

void Indicator::begin() {
    pinMode(PIXEL_POWER_PIN, OUTPUT);
    digitalWrite(PIXEL_POWER_PIN, HIGH);
    if (LIGHT_PIN >= 0) {
        ledcSetup(LIGHT_CHANNEL, 5000, 8);
        ledcAttachPin(LIGHT_PIN, LIGHT_CHANNEL);
    }
    show({0, 0, 0}, false);
}

void Indicator::flash(uint8_t r, uint8_t g, uint8_t b, int times) {
    flashColor = scale(r, g, b);
    flashTimes = times;
    flashStarted = false;
}

Indicator::Color Indicator::scale(uint8_t r, uint8_t g, uint8_t b) {
    return {(uint8_t) (r * PIXEL_BRIGHTNESS / 255), (uint8_t) (g * PIXEL_BRIGHTNESS / 255),
            (uint8_t) (b * PIXEL_BRIGHTNESS / 255)};
}

void Indicator::update(uint32_t nowMs) {
    if (flashTimes > 0) {
        if (!flashStarted) {
            flashStarted = true;
            flashStartMs = nowMs;
        }
        uint32_t elapsed = nowMs - flashStartMs;
        if (elapsed < flashTimes * FLASH_PERIOD_MS) {
            bool on = elapsed % FLASH_PERIOD_MS < FLASH_PERIOD_MS / 2;
            show(on ? flashColor : Color{0, 0, 0}, on);
            return;
        }
        flashTimes = 0;
    }
    if (batteryLow && pattern != Pattern::OFF && nowMs % 5000 < 150) {
        show(scale(255, 80, 0), false);
        return;
    }
    const Color off = {0, 0, 0};
    switch (pattern) {
        case Pattern::CONNECTING:
            show(nowMs % 500 < 250 ? scale(0, 0, 255) : off, false);
            break;
        case Pattern::NO_WIFI:
            show(nowMs % 1000 < 500 ? scale(255, 0, 255) : off, false);
            break;
        case Pattern::LOST:
            show(nowMs % 1000 < 500 ? scale(255, 180, 0) : off, false);
            break;
        case Pattern::IDLE:
            show(nowMs % 2000 < 100 ? scale(0, 255, 255) : off, false);
            break;
        case Pattern::READY:
            show(scale(0, 255, 0), true);
            break;
        case Pattern::LOCKED:
            show(scale(60, 0, 0), false);
            break;
        case Pattern::SELECTED: {
            bool on = nowMs % 200 < 100;
            show(on ? scale(255, 255, 255) : off, on);
            break;
        }
        case Pattern::OFF:
        default:
            show(off, false);
    }
}

void Indicator::show(Color color, bool light) {
    if (!(color == shown)) {
        // writing the NeoPixel takes a moment, so only changes
        neopixelWrite(PIN_NEOPIXEL, color.r, color.g, color.b);
        shown = color;
    }
    if (LIGHT_PIN >= 0 && (int) light != shownLight) {
        ledcWrite(LIGHT_CHANNEL, light ? 255 : 0);
        shownLight = light;
    }
}

void Indicator::shutdown() {
    show({0, 0, 0}, false);
    digitalWrite(PIXEL_POWER_PIN, LOW);
}
