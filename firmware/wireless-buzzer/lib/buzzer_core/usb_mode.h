#pragma once

#include <stdint.h>

/**
 * Decides whether the game goes over USB or over the WiFi. While the box talks to the buzzer over USB (BUZZ LINK, and
 * then its answers to the heartbeats there), the heartbeats and presses go over USB, which doesn't suffer from a busy
 * WiFi. Once the cable is pulled, or the box stops answering there, they go over the WiFi again right away. The WiFi
 * stays connected meanwhile, and a heartbeat now and then (STANDBY) tells the server that it still works.
 *
 * Only the box sends BUZZ LINK; on a computer the buzzer stays on the WiFi.
 */
class UsbMode {
public:
    enum class Change {
        NONE,
        // the game goes over USB from now on
        TO_USB,
        // the game goes over the WiFi again
        TO_WIFI
    };

    struct Timeouts {
        // without anything from the box over USB for this long, the link counts as gone
        uint32_t contactMs;
    };

    explicit UsbMode(const Timeouts &timeouts) : timeouts(timeouts) {}

    /** BUZZ LINK, or an answer of the server over USB */
    void onContact(uint32_t nowMs);
    /**
     * Once per loop, with whether USB is plugged in; tells when the link changes. Unplugging ends the link right away,
     * also when the box answered a moment before.
     */
    Change update(uint32_t nowMs, bool usbConnected);
    bool isLinked() const { return linked; }
    /**
     * Whether a press goes over the WiFi as well: without the link, and after a few sends over USB without an answer,
     * in case the cable was just pulled (the server takes each press number once)
     */
    static bool sendsPressOverWifi(bool linked, int sends, int usbOnlySends);

private:
    Timeouts timeouts;
    bool hadContact = false;
    uint32_t lastContactMs = 0;
    bool linked = false;

    // see PowerPolicy::since
    static uint32_t since(uint32_t nowMs, uint32_t thenMs) {
        int32_t elapsed = (int32_t) (nowMs - thenMs);
        return elapsed < 0 ? 0 : (uint32_t) elapsed;
    }
};
