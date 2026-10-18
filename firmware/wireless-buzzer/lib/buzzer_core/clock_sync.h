#pragma once

#include <stdint.h>

/**
 * Follows the game server's clock, so that a press can be sent with the time it happened on that clock. The server
 * compares the presses of a short window by that time (BuzzUI UdpBuzzerService), which is fair even when one press
 * takes longer over the WiFi.
 *
 * Each heartbeat carries a sequence number, and the server's answer echoes it with its clock. Halfway between sending
 * and receiving, the server's clock showed that time (as NTP assumes). Of the last samples, the one with the shortest
 * round trip is the most exact.
 */
class ClockSync {
public:
    static const int SAMPLES = 8;
    // the server's clock starts at 0 when the server starts; a jump of more than this (beyond what the round trips
    // allow) means the old samples are wrong
    static const int64_t RESTART_JUMP_US = 500000;

    void onSent(uint32_t seq, int64_t localUs);
    /** Returns false for an answer to a heartbeat it doesn't know (too old, or sent before a restart) */
    bool onAnswer(uint32_t seq, int64_t serverUs, int64_t localUs);
    bool isSynced() const { return sampleCount > 0; }
    int64_t toServer(int64_t localUs) const;
    /** The round trip of the sample in use, in µs; how exact the time is */
    int64_t accuracyUs() const;
    void reset();

private:
    struct Pending {
        uint32_t seq;
        int64_t sentUs;
        bool used;
    };
    struct Sample {
        int64_t roundTripUs;
        int64_t offsetUs;
    };

    Pending pending[SAMPLES] = {};
    Sample samples[SAMPLES] = {};
    int nextPending = 0;
    int nextSample = 0;
    int sampleCount = 0;

    const Sample *best() const;
};
