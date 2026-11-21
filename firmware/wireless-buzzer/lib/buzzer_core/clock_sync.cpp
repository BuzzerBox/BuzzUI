#include "clock_sync.h"

#include <stdlib.h>

void ClockSync::onSent(uint32_t seq, int64_t localUs) {
    pending[nextPending] = {seq, localUs, true};
    nextPending = (nextPending + 1) % SAMPLES;
}

bool ClockSync::onAnswer(uint32_t seq, int64_t serverUs, int64_t localUs) {
    for (Pending &p : pending) {
        if (p.used && p.seq == seq) {
            p.used = false;
            int64_t roundTripUs = localUs - p.sentUs;
            if (roundTripUs < 0) {
                return false;
            }
            int64_t offsetUs = serverUs - (p.sentUs + roundTripUs / 2);
            const Sample *current = best();
            // each offset can be off by half its round trip; a larger jump than that is a restart of the server
            int64_t toleranceUs = RESTART_JUMP_US + roundTripUs / 2 + (current != nullptr ? current->roundTripUs / 2 : 0);
            if (current != nullptr && llabs(offsetUs - current->offsetUs) > toleranceUs) {
                sampleCount = 0;
                nextSample = 0;
            }
            samples[nextSample] = {roundTripUs, offsetUs};
            nextSample = (nextSample + 1) % SAMPLES;
            if (sampleCount < SAMPLES) {
                sampleCount++;
            }
            return true;
        }
    }
    return false;
}

const ClockSync::Sample *ClockSync::best() const {
    const Sample *result = nullptr;
    for (int i = 0; i < sampleCount; i++) {
        if (result == nullptr || samples[i].roundTripUs < result->roundTripUs) {
            result = &samples[i];
        }
    }
    return result;
}

int64_t ClockSync::toServer(int64_t localUs) const {
    const Sample *sample = best();
    return sample == nullptr ? localUs : localUs + sample->offsetUs;
}

int64_t ClockSync::accuracyUs() const {
    const Sample *sample = best();
    return sample == nullptr ? -1 : sample->roundTripUs;
}

void ClockSync::reset() {
    *this = ClockSync();
}
