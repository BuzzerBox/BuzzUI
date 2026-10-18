#pragma once

#include <Arduino.h>

/**
 * A button that connects its pin to GND when pressed. The interrupt takes the time of the first edge, which is when
 * the button was pressed; poll() reports the press once the pin stayed low for the debounce time.
 */
class Button {
public:
    void begin(gpio_num_t pin, uint32_t debounceMs);
    /** True once per press, with the time of the press from esp_timer_get_time() */
    bool poll(int64_t &pressedUs);
    bool isDown() const;

private:
    gpio_num_t pin = GPIO_NUM_NC;
    int64_t debounceUs = 0;
    // the button counts as held until it is released for the debounce time
    bool held = false;
    int64_t releasedSinceUs = -1;
    // set by the interrupt, cleared by poll(); 64 bits aren't written at once, hence the lock
    volatile int64_t edgeUs = -1;
    portMUX_TYPE edgeLock = portMUX_INITIALIZER_UNLOCKED;

    static void IRAM_ATTR onFallingEdge(void *button);
    int64_t readEdge();
    void clearEdge();
};
