#pragma once

#include <stdint.h>

/**
 * Decides when the buzzer goes back to deep sleep. It stays awake while the server says a game is running, and while it
 * is plugged into a computer or the box over USB. Without either it sleeps after a while without anything happening,
 * and it gives up when it can't reach the server.
 */
class PowerPolicy {
public:
    struct Timeouts {
        // to reach the server after waking up (or to get the WiFi over USB, when it has none)
        uint32_t connectMs;
        // without an answer of the server, the connection counts as lost
        uint32_t contactMs;
        // to get the connection back once it was lost
        uint32_t lostMs;
        // awake without a game and without a press
        uint32_t idleMs;
    };

    enum class Connection {
        // not yet reached the server since waking up
        CONNECTING,
        ONLINE,
        LOST
    };

    explicit PowerPolicy(const Timeouts &timeouts) : timeouts(timeouts) {}

    void onWake(uint32_t nowMs);
    /** A press, or the WiFi given over USB */
    void onActivity(uint32_t nowMs);
    /** An answer of the server */
    void onState(uint32_t nowMs, bool game);
    /**
     * Whether a computer or the box has the buzzer on USB, which can't wake it while it sleeps (the Feather ESP32-S3:
     * its USB is gone in deep sleep). Unplugging it starts the idle time.
     */
    void setPluggedIn(uint32_t nowMs, bool pluggedIn);

    Connection connection(uint32_t nowMs) const;
    bool isGameRunning(uint32_t nowMs) const;
    bool shouldSleep(uint32_t nowMs) const;

private:
    Timeouts timeouts;
    uint32_t lastActivityMs = 0;
    uint32_t lastContactMs = 0;
    bool hadContact = false;
    bool game = false;
    bool pluggedIn = false;

    // since then, also across the wraparound of millis() after 49 days. An event taken a moment after now (the loop
    // reads the time before handling what came in) is no time ago, not 49 days.
    static uint32_t since(uint32_t nowMs, uint32_t thenMs) {
        int32_t elapsed = (int32_t) (nowMs - thenMs);
        return elapsed < 0 ? 0 : (uint32_t) elapsed;
    }
};
