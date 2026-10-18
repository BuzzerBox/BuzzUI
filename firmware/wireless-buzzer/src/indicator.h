#pragma once

#include <Arduino.h>

/**
 * The NeoPixel shows what the buzzer is doing; the light (LIGHT_PIN) is the buzzer's own lamp for the players:
 *
 *   pattern        NeoPixel                    light
 *   CONNECTING     blue, blinking              off
 *   NO_WIFI        magenta, blinking           off      (plug it into the box over USB)
 *   LOST           yellow, blinking            off
 *   IDLE           cyan, short blink every 2 s off      (connected, no game)
 *   READY          green                       on       (a game, the buzzers are free)
 *   LOCKED         dim red                     off      (another team buzzed)
 *   SELECTED       white, flashing             flashing (this team buzzed)
 *
 * A low battery adds a short orange blink every 5 s. flash() shows a short sequence on top, e.g. when the WiFi was
 * given over USB.
 */
class Indicator {
public:
    enum class Pattern { OFF, CONNECTING, NO_WIFI, LOST, IDLE, READY, LOCKED, SELECTED };

    void begin();
    void setPattern(Pattern pattern) { this->pattern = pattern; }
    void setBatteryLow(bool low) { batteryLow = low; }
    /** Blinks a color a few times, before the pattern goes on */
    void flash(uint8_t r, uint8_t g, uint8_t b, int times);
    void update(uint32_t nowMs);
    /** Everything off and the NeoPixel without power, for deep sleep */
    void shutdown();

private:
    struct Color {
        uint8_t r, g, b;
        bool operator==(const Color &other) const { return r == other.r && g == other.g && b == other.b; }
    };

    Pattern pattern = Pattern::OFF;
    bool batteryLow = false;
    Color flashColor = {0, 0, 0};
    int flashTimes = 0;
    // set by the first update() after flash()
    bool flashStarted = false;
    uint32_t flashStartMs = 0;
    // what is shown, so that only changes are written
    Color shown = {1, 1, 1};
    int shownLight = -1;

    void show(Color color, bool light);
    static Color scale(uint8_t r, uint8_t g, uint8_t b);
};
