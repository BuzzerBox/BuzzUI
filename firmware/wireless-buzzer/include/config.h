#pragma once

#include <Arduino.h>

#define FIRMWARE_VERSION "1.3.0"

// ----- Hardware: an Adafruit ESP32 Feather V2 (env feather) or Feather ESP32-S3 (env feather_s3)

#if CONFIG_IDF_TARGET_ESP32S3

// The buttons that buzz and wake the buzzer; either one does. Pressed, a button connects its pin to GND.
// GPIO 0 is the Feather's BOOT button (not reset), which has a pull-up on the board.
constexpr gpio_num_t BUTTON_PIN = GPIO_NUM_0;
// The big (arcade) button, between GPIO 11 and GND, where GPIO 27 is on the Feather V2; it gets the internal pull-up,
// also while asleep. Another RTC GPIO (1-21) works too, but not 3, 4 (I2C), 7 (I2C power) or 21 (NeoPixel power).
// GPIO_NUM_NC for none.
constexpr gpio_num_t EXTERNAL_BUTTON_PIN = GPIO_NUM_11;
// powers the NeoPixel
constexpr int PIXEL_POWER_PIN = NEOPIXEL_POWER;
// powers the pull-ups of I2C, on which the fuel gauge (MAX17048) tells the battery's voltage and charge
constexpr int I2C_POWER_PIN = I2C_POWER;
// Its USB is the ESP32-S3's own, which is gone in deep sleep, so the box can't wake it: it stays awake while a
// computer or the box has it on USB
constexpr bool STAY_AWAKE_ON_USB = true;

#else

// The buttons that buzz and wake the buzzer; either one does. Pressed, a button connects its pin to GND.
// GPIO 38 is the Feather's user button (not reset), which has a pull-up on the board.
constexpr gpio_num_t BUTTON_PIN = GPIO_NUM_38;
// The big (arcade) button, between GPIO 27 (A10) and GND; it gets the internal pull-up, also while asleep. Another RTC
// GPIO works too (4, 14, 25-27, 32, 33; not 12 and 15, which decide how the ESP32 starts, nor 34-39 without a pull-up
// resistor). GPIO_NUM_NC for none.
constexpr gpio_num_t EXTERNAL_BUTTON_PIN = GPIO_NUM_27;
// powers the NeoPixel (and I2C)
constexpr int PIXEL_POWER_PIN = NEOPIXEL_I2C_POWER;
// VBAT through a 1:1 divider
constexpr int BATTERY_PIN = BATT_MONITOR;
// The box wakes it through the reset line of its USB serial chip
constexpr bool STAY_AWAKE_ON_USB = false;

#endif

// Whether the pin has an internal pull-up: on the ESP32, GPIO 34-39 have none
constexpr bool hasPullUp(gpio_num_t pin) {
#if CONFIG_IDF_TARGET_ESP32S3
    return pin != GPIO_NUM_NC;
#else
    return pin != GPIO_NUM_NC && pin < GPIO_NUM_34;
#endif
}

// The light of the buzzer, high when on: the Feather's red LED, or the LED of an arcade button through a transistor.
// -1 for none.
constexpr int LIGHT_PIN = LED_BUILTIN;
// The NeoPixel shows the status; dim, as it draws up to 60 mA at full brightness
constexpr uint8_t PIXEL_BRIGHTNESS = 40;
constexpr uint16_t BATTERY_LOW_MV = 3500;

// ----- Network

// the port the buzzer receives the server's STATE packets on
constexpr uint16_t LOCAL_PORT = 5006;
constexpr uint32_t HEARTBEAT_INTERVAL_MS = 1000;
// a press is sent again until the server acknowledges it
constexpr uint32_t PRESS_RESEND_INTERVAL_MS = 30;
constexpr int PRESS_SENDS = 10;
// a WiFi connection with the channel and access point of the last one is quicker; after this, it scans
constexpr uint32_t FAST_CONNECT_TIMEOUT_MS = 3000;
// not connected for this long, it starts over with a scan: the Arduino core doesn't reconnect after every drop (not
// when the box's access point shuts down), and its reconnect keeps the channel of the last connection
constexpr uint32_t RECONNECT_TIMEOUT_MS = 10000;

// ----- Power (see PowerPolicy)

constexpr uint32_t CONNECT_TIMEOUT_MS = 30000;
constexpr uint32_t CONTACT_TIMEOUT_MS = 5000;
constexpr uint32_t LOST_TIMEOUT_MS = 60000;
constexpr uint32_t IDLE_TIMEOUT_MS = 10 * 60 * 1000;

constexpr uint32_t DEBOUNCE_MS = 15;
// before sleeping, the wait for a held button to be released; one held longer is stuck, and wakes the buzzer when it
// is released
constexpr uint32_t HELD_BUTTON_WAIT_MS = 2000;
