#include "power_policy.h"

void PowerPolicy::onWake(uint32_t nowMs) {
    lastActivityMs = nowMs;
    hadContact = false;
    game = false;
}

void PowerPolicy::onActivity(uint32_t nowMs) {
    lastActivityMs = nowMs;
}

void PowerPolicy::onState(uint32_t nowMs, bool gameRunning) {
    lastContactMs = nowMs;
    hadContact = true;
    // the end of a game starts the idle time
    if (game && !gameRunning) {
        lastActivityMs = nowMs;
    }
    game = gameRunning;
}

PowerPolicy::Connection PowerPolicy::connection(uint32_t nowMs) const {
    if (!hadContact) {
        return Connection::CONNECTING;
    }
    return since(nowMs, lastContactMs) <= timeouts.contactMs ? Connection::ONLINE : Connection::LOST;
}

bool PowerPolicy::isGameRunning(uint32_t nowMs) const {
    return game && connection(nowMs) == Connection::ONLINE;
}

bool PowerPolicy::shouldSleep(uint32_t nowMs) const {
    switch (connection(nowMs)) {
        case Connection::CONNECTING:
            return since(nowMs, lastActivityMs) > timeouts.connectMs;
        case Connection::LOST:
            // also in a game: a box that is gone doesn't come back, and a press wakes the buzzer again
            return since(nowMs, lastContactMs) > timeouts.lostMs;
        case Connection::ONLINE:
        default:
            return !game && since(nowMs, lastActivityMs) > timeouts.idleMs;
    }
}
