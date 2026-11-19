#include <stdio.h>
#include <string.h>
#include <initializer_list>
#include <unity.h>

#include "clock_sync.h"
#include "messages.h"
#include "power_policy.h"

void setUp() {}
void tearDown() {}

// ----- ClockSync

void test_clock_follows_the_server_from_the_middle_of_the_round_trip() {
    ClockSync sync;
    TEST_ASSERT_FALSE(sync.isSynced());
    sync.onSent(1, 1000);
    // sent at 1000, answered at 1400: the server's 50000 was at 1200
    TEST_ASSERT_TRUE(sync.onAnswer(1, 50000, 1400));
    TEST_ASSERT_TRUE(sync.isSynced());
    TEST_ASSERT_EQUAL_INT64(50000, sync.toServer(1200));
    TEST_ASSERT_EQUAL_INT64(50800, sync.toServer(2000));
}

void test_clock_takes_the_sample_with_the_shortest_round_trip() {
    ClockSync sync;
    sync.onSent(1, 0);
    // a slow answer: 30 ms, and its offset is off by 15 ms
    sync.onAnswer(1, 429000, 30000);
    sync.onSent(2, 100000);
    // 2 ms round trip: server 500000 at local 101000
    sync.onAnswer(2, 500000, 102000);
    sync.onSent(3, 200000);
    // 50 ms round trip, off by 24 ms
    sync.onAnswer(3, 600000, 250000);
    TEST_ASSERT_EQUAL_INT64(2000, sync.accuracyUs());
    TEST_ASSERT_EQUAL_INT64(500000, sync.toServer(101000));
}

void test_clock_ignores_unknown_and_repeated_answers() {
    ClockSync sync;
    sync.onSent(5, 0);
    TEST_ASSERT_FALSE(sync.onAnswer(4, 1000, 100));
    TEST_ASSERT_TRUE(sync.onAnswer(5, 1000, 100));
    TEST_ASSERT_FALSE(sync.onAnswer(5, 9999, 200));
    TEST_ASSERT_EQUAL_INT64(1000, sync.toServer(50));
}

void test_clock_forgets_old_samples() {
    ClockSync sync;
    sync.onSent(0, 0);
    // the best sample, but SAMPLES newer ones push it out
    sync.onAnswer(0, 1000000, 10);
    for (uint32_t i = 1; i <= ClockSync::SAMPLES; i++) {
        int64_t sent = i * 1000000;
        sync.onSent(i, sent);
        sync.onAnswer(i, 7000 + sent + 500, sent + 1000);
    }
    TEST_ASSERT_EQUAL_INT64(1000, sync.accuracyUs());
    TEST_ASSERT_EQUAL_INT64(7000 + 5000000, sync.toServer(5000000));
}

void test_clock_keeps_its_samples_for_a_slow_answer() {
    ClockSync sync;
    sync.onSent(1, 0);
    sync.onAnswer(1, 1000000, 2000);
    // 1.5 s round trip: the offset may be off by 750 ms, that's no restart
    sync.onSent(2, 10000000);
    sync.onAnswer(2, 10999000 + 700000, 11500000);
    TEST_ASSERT_EQUAL_INT64(2000, sync.accuracyUs());
}

void test_clock_starts_over_when_the_server_restarted() {
    ClockSync sync;
    sync.onSent(1, 1000000);
    sync.onAnswer(1, 900000000, 1001000);
    sync.onSent(2, 2000000);
    // a slower answer, but from a server that just started
    sync.onAnswer(2, 20000, 2010000);
    TEST_ASSERT_EQUAL_INT64(10000, sync.accuracyUs());
    TEST_ASSERT_EQUAL_INT64(20000, sync.toServer(2005000));
}

// ----- PowerPolicy

static const PowerPolicy::Timeouts TIMEOUTS = {20000, 5000, 60000, 600000};

void test_sleeps_when_the_server_is_not_reached() {
    PowerPolicy policy(TIMEOUTS);
    policy.onWake(1000);
    TEST_ASSERT_TRUE(policy.connection(1000) == PowerPolicy::Connection::CONNECTING);
    TEST_ASSERT_FALSE(policy.shouldSleep(21000));
    TEST_ASSERT_TRUE(policy.shouldSleep(21001));
}

void test_stays_awake_during_a_game() {
    PowerPolicy policy(TIMEOUTS);
    policy.onWake(0);
    for (uint32_t now = 1000; now < 3600000; now += 1000) {
        policy.onState(now, true);
        TEST_ASSERT_FALSE(policy.shouldSleep(now + 500));
    }
    TEST_ASSERT_TRUE(policy.isGameRunning(3600000));
}

void test_sleeps_after_the_idle_time_without_a_game() {
    PowerPolicy policy(TIMEOUTS);
    policy.onWake(0);
    policy.onState(1000, false);
    policy.onActivity(100000);
    for (uint32_t now = 2000; now <= 700000; now += 1000) {
        policy.onState(now, false);
    }
    TEST_ASSERT_FALSE(policy.shouldSleep(700000));
    TEST_ASSERT_TRUE(policy.shouldSleep(700001));
}

void test_the_end_of_a_game_starts_the_idle_time() {
    PowerPolicy policy(TIMEOUTS);
    policy.onWake(0);
    for (uint32_t now = 1000; now <= 2000000; now += 1000) {
        policy.onState(now, true);
    }
    // the game ends at 2001000; the server keeps answering every second
    for (uint32_t now = 2001000; now <= 2001000 + 600000; now += 1000) {
        policy.onState(now, false);
    }
    TEST_ASSERT_FALSE(policy.shouldSleep(2001000 + 600000));
    TEST_ASSERT_TRUE(policy.shouldSleep(2001000 + 600001));
}

void test_a_lost_server_ends_even_a_game_after_a_while() {
    PowerPolicy policy(TIMEOUTS);
    policy.onWake(0);
    policy.onState(1000, true);
    TEST_ASSERT_TRUE(policy.connection(6001) == PowerPolicy::Connection::LOST);
    TEST_ASSERT_FALSE(policy.isGameRunning(6001));
    TEST_ASSERT_FALSE(policy.shouldSleep(61000));
    TEST_ASSERT_TRUE(policy.shouldSleep(61001));
    // back in time
    policy.onState(50000, true);
    TEST_ASSERT_FALSE(policy.shouldSleep(61001));
}

void test_timeouts_survive_the_millis_wraparound() {
    PowerPolicy policy(TIMEOUTS);
    uint32_t start = 0xFFFFFFFFu - 5000;
    policy.onWake(start);
    TEST_ASSERT_FALSE(policy.shouldSleep(start + 10000));
    TEST_ASSERT_TRUE(policy.shouldSleep(start + 20001));
}

void test_an_event_a_moment_after_now_is_no_time_ago() {
    PowerPolicy policy(TIMEOUTS);
    policy.onWake(1000);
    // the loop took the time at 5000, then handled a line from USB at 5001
    policy.onActivity(5001);
    TEST_ASSERT_FALSE(policy.shouldSleep(5000));
    // and an answer of the server
    policy.onState(5001, true);
    TEST_ASSERT_TRUE(policy.connection(5000) == PowerPolicy::Connection::ONLINE);
    TEST_ASSERT_FALSE(policy.shouldSleep(5000));
}

void test_stays_awake_while_plugged_in() {
    PowerPolicy policy(TIMEOUTS);
    policy.onWake(0);
    policy.setPluggedIn(0, true);
    // no WiFi and no server, for an hour
    TEST_ASSERT_FALSE(policy.shouldSleep(3600000));
    // unplugged, it has the time to connect again
    policy.setPluggedIn(3600000, false);
    TEST_ASSERT_FALSE(policy.shouldSleep(3600000 + 20000));
    TEST_ASSERT_TRUE(policy.shouldSleep(3600000 + 20001));
}

void test_stays_awake_while_plugged_in_after_losing_the_server() {
    PowerPolicy policy(TIMEOUTS);
    policy.onWake(0);
    policy.onState(1000, false);
    policy.setPluggedIn(1000, true);
    TEST_ASSERT_TRUE(policy.connection(100000) == PowerPolicy::Connection::LOST);
    TEST_ASSERT_FALSE(policy.shouldSleep(100000));
}

// ----- messages

void test_builds_a_heartbeat() {
    char out[200];
    messages::Diagnostics diagnostics;
    diagnostics.resetReason = "BROWNOUT";
    diagnostics.uptimeS = 42;
    size_t length = messages::buildHeartbeat(out, sizeof(out), "AA:BB:CC:DD:EE:01", 5006, 7, 3912, "1.0.0", diagnostics);
    TEST_ASSERT_EQUAL_STRING("{\"t\":\"HB\",\"id\":\"AA:BB:CC:DD:EE:01\",\"lp\":5006,\"seq\":7,\"bat\":3912,\"fw\":\"1.0.0\","
                             "\"rr\":\"BROWNOUT\",\"up\":42,\"wd\":0}", out);
    TEST_ASSERT_EQUAL(strlen(out), length);
    // the reason of the last WiFi drop only once there was one
    diagnostics.wifiDrops = 3;
    diagnostics.lastWifiReason = 200;
    messages::buildHeartbeat(out, sizeof(out), "AA:BB:CC:DD:EE:01", 5006, 7, 3912, "1.0.0", diagnostics);
    TEST_ASSERT_NOT_NULL(strstr(out, "\"wd\":3,\"wr\":200}"));
}

void test_tells_the_color_in_the_heartbeat() {
    char out[200];
    messages::buildHeartbeat(out, sizeof(out), "AA:BB:CC:DD:EE:01", 5006, 7, 3912, "1.0.0", messages::Diagnostics(),
                             "#1e88e5");
    TEST_ASSERT_NOT_NULL(strstr(out, ",\"col\":\"#1e88e5\"}"));
    messages::buildHeartbeat(out, sizeof(out), "AA:BB:CC:DD:EE:01", 5006, 7, 3912, "1.0.0", messages::Diagnostics(), "");
    TEST_ASSERT_NULL(strstr(out, "col"));
}

void test_tells_the_battery_charge_in_the_heartbeat() {
    char out[200];
    messages::buildHeartbeat(out, sizeof(out), "AA:BB:CC:DD:EE:01", 5006, 7, 3912, "1.3.0", messages::Diagnostics(),
                             "", 87);
    TEST_ASSERT_NOT_NULL(strstr(out, ",\"pct\":87}"));
    // a fuel gauge may tell more than 100 % right after charging
    messages::buildHeartbeat(out, sizeof(out), "AA:BB:CC:DD:EE:01", 5006, 7, 4200, "1.3.0", messages::Diagnostics(),
                             "", 103);
    TEST_ASSERT_NOT_NULL(strstr(out, ",\"pct\":100}"));
    messages::buildHeartbeat(out, sizeof(out), "AA:BB:CC:DD:EE:01", 5006, 7, 3912, "1.3.0", messages::Diagnostics());
    TEST_ASSERT_NULL(strstr(out, "pct"));
}

void test_builds_a_press_with_and_without_the_server_time() {
    char out[200];
    messages::buildPress(out, sizeof(out), "AA:BB:CC:DD:EE:01", 3, true, 12345678901LL);
    TEST_ASSERT_EQUAL_STRING("{\"t\":\"PRESS\",\"id\":\"AA:BB:CC:DD:EE:01\",\"n\":3,\"ts\":12345678901}", out);
    messages::buildPress(out, sizeof(out), "AA:BB:CC:DD:EE:01", 4, false, 0);
    TEST_ASSERT_EQUAL_STRING("{\"t\":\"PRESS\",\"id\":\"AA:BB:CC:DD:EE:01\",\"n\":4}", out);
}

void test_does_not_overflow_a_small_buffer() {
    char out[20];
    TEST_ASSERT_EQUAL(0, messages::buildHeartbeat(out, sizeof(out), "AA:BB:CC:DD:EE:01", 5006, 7, 3912, "1.0.0",
                                                  messages::Diagnostics()));
}

void test_parses_a_state() {
    const char *json = "{\"t\":\"STATE\",\"selected\":true,\"locked\":true,\"game\":true,\"st\":98765432101,\"ack\":12}";
    messages::State state;
    TEST_ASSERT_TRUE(messages::parseState(json, strlen(json), state));
    TEST_ASSERT_TRUE(state.selected);
    TEST_ASSERT_TRUE(state.locked);
    TEST_ASSERT_TRUE(state.game);
    TEST_ASSERT_EQUAL_INT64(98765432101LL, state.serverUs);
    TEST_ASSERT_TRUE(state.hasAck);
    TEST_ASSERT_EQUAL_UINT32(12, state.ack);
    TEST_ASSERT_FALSE(state.hasPressAck);
}

void test_parses_a_state_of_an_older_server() {
    const char *json = "{\"t\":\"STATE\",\"selected\":false,\"locked\":false}";
    messages::State state;
    TEST_ASSERT_TRUE(messages::parseState(json, strlen(json), state));
    TEST_ASSERT_FALSE(state.game);
    TEST_ASSERT_FALSE(state.hasAck);
}

void test_rejects_other_packets() {
    messages::State state;
    const char *other = "{\"t\":\"HB\"}";
    TEST_ASSERT_FALSE(messages::parseState(other, strlen(other), state));
    const char *broken = "{\"t\":\"STATE\"";
    TEST_ASSERT_FALSE(messages::parseState(broken, strlen(broken), state));
}

void test_tells_its_wifi_without_the_passphrase() {
    messages::WifiSettings wifi;
    strcpy(wifi.ssid, "Box \"7\"");
    strcpy(wifi.passphrase, "secret123");
    strcpy(wifi.host, "10.0.0.5");
    wifi.port = 5005;
    char out[200];
    messages::buildWifiInfo(out, sizeof(out), true, wifi);
    TEST_ASSERT_EQUAL_STRING("{\"ssid\":\"Box \\\"7\\\"\",\"host\":\"10.0.0.5\",\"port\":5005}", out);
    TEST_ASSERT_NULL(strstr(out, "secret"));
    messages::buildWifiInfo(out, sizeof(out), false, wifi);
    TEST_ASSERT_EQUAL_STRING("{}", out);
    strcpy(wifi.color, "#fdd835");
    messages::buildWifiInfo(out, sizeof(out), true, wifi);
    TEST_ASSERT_EQUAL_STRING("{\"ssid\":\"Box \\\"7\\\"\",\"host\":\"10.0.0.5\",\"port\":5005,\"color\":\"#fdd835\"}", out);
}

void test_parses_the_wifi() {
    messages::WifiSettings wifi;
    TEST_ASSERT_TRUE(messages::parseWifi(
        "{\"ssid\":\"BuzzerBox \\\"7\\\"\",\"pass\":\"12345678=!\",\"host\":\"10.0.0.5\",\"port\":5005}", wifi));
    TEST_ASSERT_EQUAL_STRING("BuzzerBox \"7\"", wifi.ssid);
    TEST_ASSERT_EQUAL_STRING("12345678=!", wifi.passphrase);
    TEST_ASSERT_EQUAL_STRING("10.0.0.5", wifi.host);
    TEST_ASSERT_EQUAL_UINT16(5005, wifi.port);
    TEST_ASSERT_FALSE(wifi.hasColor);
    TEST_ASSERT_EQUAL_STRING("", wifi.color);
}

void test_parses_the_color() {
    messages::WifiSettings wifi;
    TEST_ASSERT_TRUE(messages::parseWifi(
        "{\"ssid\":\"a\",\"pass\":\"12345678\",\"host\":\"h\",\"port\":5005,\"color\":\"#1E88E5\"}", wifi));
    TEST_ASSERT_TRUE(wifi.hasColor);
    TEST_ASSERT_EQUAL_STRING("#1e88e5", wifi.color);
    // an empty one takes the color away
    TEST_ASSERT_TRUE(messages::parseWifi(
        "{\"ssid\":\"a\",\"pass\":\"12345678\",\"host\":\"h\",\"port\":5005,\"color\":\"\"}", wifi));
    TEST_ASSERT_TRUE(wifi.hasColor);
    TEST_ASSERT_EQUAL_STRING("", wifi.color);
}

void test_rejects_an_invalid_color() {
    messages::WifiSettings wifi;
    strcpy(wifi.ssid, "kept");
    for (const char *color : {"\"blue\"", "\"#12345\"", "\"#1234567\"", "\"#12345g\"", "\"112233\"", "3"}) {
        char json[120];
        snprintf(json, sizeof(json), "{\"ssid\":\"a\",\"pass\":\"12345678\",\"host\":\"h\",\"port\":5005,\"color\":%s}", color);
        TEST_ASSERT_FALSE_MESSAGE(messages::parseWifi(json, wifi), color);
    }
    TEST_ASSERT_EQUAL_STRING("kept", wifi.ssid);
}

void test_rejects_invalid_wifi() {
    messages::WifiSettings wifi;
    strcpy(wifi.ssid, "kept");
    // passphrase too short
    TEST_ASSERT_FALSE(messages::parseWifi("{\"ssid\":\"a\",\"pass\":\"1234567\",\"host\":\"h\",\"port\":5005}", wifi));
    // SSID longer than 32 bytes
    TEST_ASSERT_FALSE(messages::parseWifi(
        "{\"ssid\":\"123456789012345678901234567890123\",\"pass\":\"12345678\",\"host\":\"h\",\"port\":5005}", wifi));
    TEST_ASSERT_FALSE(messages::parseWifi("{\"ssid\":\"a\",\"pass\":\"12345678\",\"host\":\"h\"}", wifi));
    TEST_ASSERT_FALSE(messages::parseWifi("not json", wifi));
    TEST_ASSERT_EQUAL_STRING("kept", wifi.ssid);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_clock_follows_the_server_from_the_middle_of_the_round_trip);
    RUN_TEST(test_clock_takes_the_sample_with_the_shortest_round_trip);
    RUN_TEST(test_clock_ignores_unknown_and_repeated_answers);
    RUN_TEST(test_clock_forgets_old_samples);
    RUN_TEST(test_clock_keeps_its_samples_for_a_slow_answer);
    RUN_TEST(test_clock_starts_over_when_the_server_restarted);
    RUN_TEST(test_sleeps_when_the_server_is_not_reached);
    RUN_TEST(test_stays_awake_during_a_game);
    RUN_TEST(test_sleeps_after_the_idle_time_without_a_game);
    RUN_TEST(test_the_end_of_a_game_starts_the_idle_time);
    RUN_TEST(test_a_lost_server_ends_even_a_game_after_a_while);
    RUN_TEST(test_timeouts_survive_the_millis_wraparound);
    RUN_TEST(test_an_event_a_moment_after_now_is_no_time_ago);
    RUN_TEST(test_stays_awake_while_plugged_in);
    RUN_TEST(test_stays_awake_while_plugged_in_after_losing_the_server);
    RUN_TEST(test_builds_a_heartbeat);
    RUN_TEST(test_tells_the_color_in_the_heartbeat);
    RUN_TEST(test_tells_the_battery_charge_in_the_heartbeat);
    RUN_TEST(test_builds_a_press_with_and_without_the_server_time);
    RUN_TEST(test_does_not_overflow_a_small_buffer);
    RUN_TEST(test_parses_a_state);
    RUN_TEST(test_parses_a_state_of_an_older_server);
    RUN_TEST(test_rejects_other_packets);
    RUN_TEST(test_tells_its_wifi_without_the_passphrase);
    RUN_TEST(test_parses_the_wifi);
    RUN_TEST(test_parses_the_color);
    RUN_TEST(test_rejects_an_invalid_color);
    RUN_TEST(test_rejects_invalid_wifi);
    return UNITY_END();
}
