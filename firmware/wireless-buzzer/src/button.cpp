#include "button.h"

#include "config.h"

#include <esp_timer.h>

void IRAM_ATTR Button::onFallingEdge(void *arg) {
    Button *button = static_cast<Button *>(arg);
    portENTER_CRITICAL_ISR(&button->edgeLock);
    if (button->edgeUs < 0) {
        button->edgeUs = esp_timer_get_time();
    }
    portEXIT_CRITICAL_ISR(&button->edgeLock);
}

int64_t Button::readEdge() {
    portENTER_CRITICAL(&edgeLock);
    int64_t edge = edgeUs;
    portEXIT_CRITICAL(&edgeLock);
    return edge;
}

void Button::clearEdge() {
    portENTER_CRITICAL(&edgeLock);
    edgeUs = -1;
    portEXIT_CRITICAL(&edgeLock);
}

void Button::begin(gpio_num_t buttonPin, uint32_t debounceMs) {
    pin = buttonPin;
    debounceUs = (int64_t) debounceMs * 1000;
    // the ESP32's pins 34-39 have no pull-ups, the board has one
    pinMode(pin, hasPullUp(pin) ? INPUT_PULLUP : INPUT);
    // the press that woke the buzzer up doesn't buzz
    held = isDown();
    attachInterruptArg(digitalPinToInterrupt(pin), onFallingEdge, this, FALLING);
}

bool Button::isDown() const {
    return digitalRead(pin) == LOW;
}

bool Button::poll(int64_t &pressedUs) {
    int64_t now = esp_timer_get_time();
    if (held) {
        if (isDown()) {
            releasedSinceUs = -1;
        } else if (releasedSinceUs < 0) {
            releasedSinceUs = now;
        } else if (now - releasedSinceUs >= debounceUs) {
            held = false;
            releasedSinceUs = -1;
        }
        // bounces while held or on release
        clearEdge();
        return false;
    }
    int64_t edge = readEdge();
    if (edge < 0 || now - edge < debounceUs) {
        return false;
    }
    clearEdge();
    if (!isDown()) {
        // a glitch
        return false;
    }
    held = true;
    pressedUs = edge;
    return true;
}
