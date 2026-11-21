# Wireless buzzer

Firmware for a battery-powered buzzer on an [Adafruit ESP32 Feather V2](https://www.adafruit.com/product/5400) or an
[Adafruit Feather ESP32-S3](https://www.adafruit.com/product/5323) (No PSRAM, or the one with 2 MB PSRAM). It talks to the BuzzerBox's game server over the box's WiFi, and the box shows it to the game master like its own buzzers
(named after the color of its case, e.g. "Blauer Wireless Buzzer", or as "Funkbuzzer" with the end of its MAC
address while it has no color).

## How it behaves

- **Asleep** until its button is pressed. That press only wakes it up; it doesn't buzz.
- **Awake**, it connects to the box's WiFi and game server. The first connection after a power-up scans for the box
  (a few seconds), later ones go straight to the box's channel.
- It **stays awake while a game with the wireless buzzers is running** on the box (also while the game master's device
  is away). A game is played either with them or with the box's own buzzers.
- **When the WiFi drops**, for example because the box restarted, it looks for the box's WiFi again every 10 s.
- **Without a game** it goes back to sleep 10 minutes after the last press. It also goes to sleep when it can't reach
  the box within 30 s of waking, or loses it for a minute. A button that is stuck (held for more than 2 s when it
  goes to sleep) wakes it when it is released, not right away.
- **Plugged into the box over USB**, it shows up as a card on the game master's home page. "Übernehmen" there gives
  it the box's WiFi name and password and its address; the NeoPixel flashes green three times when it got them. A
  buzzer that has the box's WiFi already shows as adopted. The card also asks for the **color of the case**: the
  buzzer keeps it in its flash and tells it to every box, which shows it next to the buzzer and as its team's color
  on the screens. Changing it later works the same way ("Farbe übernehmen"). The
  box wakes a sleeping Feather V2 for that (through the reset line). A Feather ESP32-S3 can't be woken over USB (its
  USB is gone while it sleeps), so it **stays awake while a computer or the box has it on USB**; one that sleeps when
  it is plugged in shows up once its button is pressed. The USB cable also charges the battery.
- The game master's home page lists the connected wireless buzzers: their color, firmware, battery (in % on a
  Feather ESP32-S3, which has a fuel gauge) and whether they are connected over USB, WiFi or both.

## Lights

The NeoPixel on the Feather shows the status; the light (`LIGHT_PIN`, the Feather's red LED or an arcade button's lamp)
is for the players.

| Status | NeoPixel | Light |
|---|---|---|
| Connecting | blue, blinking | off |
| No WiFi yet: plug it into the box | magenta, blinking | off |
| Lost the box, trying again | yellow, blinking | off |
| Connected, no game | cyan, short blink every 2 s | off |
| Game, buzzers free | green | on |
| Game, another team buzzed | dim red | off |
| Game, **this team buzzed** | white, flashing | flashing |
| Got the WiFi over USB | green, 3 flashes | |
| Got invalid WiFi settings | red, 3 flashes | |

A low battery (below 3.5 V) adds a short orange blink every 5 s, and the game master sees a battery icon next to the
buzzer.

## Hardware

### Feather V2 (`pio run -e feather`, the default)

| Part | Pin |
|---|---|
| Button | GPIO 38, the Feather's user button, not reset (`BUTTON_PIN`) |
| Big button | GPIO 27 (A10) to GND (`EXTERNAL_BUTTON_PIN`); either button buzzes and wakes the buzzer |
| Light | GPIO 13, the Feather's red LED (`LIGHT_PIN`) |
| NeoPixel | GPIO 0, powered through GPIO 2 (off while asleep) |
| Battery voltage | GPIO 35 (A13), halved by the Feather's divider |
| Battery | a 3.7 V LiPo on the JST connector |

### Feather ESP32-S3 (`pio run -e feather_s3`)

| Part | Pin |
|---|---|
| Button | GPIO 0, the Feather's BOOT button (`BUTTON_PIN`) |
| Big button | GPIO 11 to GND, where GPIO 27 is on the Feather V2 (`EXTERNAL_BUTTON_PIN`) |
| Light | GPIO 13, the Feather's red LED (`LIGHT_PIN`) |
| NeoPixel | GPIO 33, powered through GPIO 21 (off while asleep) |
| Battery | voltage and charge from the MAX17048 fuel gauge on I2C (0x36), whose pull-ups GPIO 7 powers |
| USB | the ESP32-S3's own (USB CDC, `239a:8113`, with 2 MB PSRAM `239a:811b`) |

Older Feather ESP32-S3 have an LC709203F fuel gauge instead of the MAX17048; the firmware doesn't read it, so such a
buzzer tells no battery. On the S3 the big button can go on another RTC GPIO (1-21), but not 3, 4 (I2C), 7 or 21.

Both buttons work at the same time, so the Feather's own button stays handy for testing. The big button needs no
resistor: GPIO 27 gets the internal pull-up, also while asleep. It can go on another RTC GPIO (`EXTERNAL_BUTTON_PIN` in
`include/config.h`): 4, 14, 25-27, 32 or 33. Avoid 12 and 15, which decide how the ESP32 starts, and 34-39, which
would need a pull-up resistor. `GPIO_NUM_NC` turns the big button off. The lamp of an arcade button usually needs more
current or voltage than a GPIO gives, so switch it with a transistor on `LIGHT_PIN`.

## Building and flashing

With [PlatformIO](https://platformio.org/), from this directory:

```bash
pio run                              # build for the Feather V2 (-e feather_s3 for the Feather ESP32-S3)
pio run --target upload              # flash over USB
pio device monitor                   # serial log at 115200 baud
pio test -e native                   # tests of lib/buzzer_core on this computer
```

A Feather ESP32-S3 that runs other firmware may not restart into its bootloader by itself. Then hold BOOT, press
RESET and let go of BOOT before the upload; press RESET once more afterwards. With this firmware, uploads work without
the buttons.

## Protocol

JSON over UDP with the game server (BuzzUI `server/services/udp-buzzer.service.ts`, port 5005; the buzzer listens on
5006):

| Direction | Packet |
|---|---|
| buzzer → server, every second | `{"t":"HB","id":<MAC>,"lp":5006,"seq":<n>,"bat":<mV>,"fw":<version>,"col":<"#rrggbb">,"pct":<%>}` |
| buzzer → server | `{"t":"PRESS","id":<MAC>,"n":<press number>,"ts":<µs on the server's clock>}` |
| server → buzzer | `{"t":"STATE","selected":…,"locked":…,"game":…,"st":<server µs>,"ack":<seq>,"pa":<n>}` |

`pct` is the charge of the battery from the fuel gauge of a Feather ESP32-S3 (since firmware 1.3.0); the Feather V2
only tells the voltage (`bat`). The server answers every heartbeat (`ack`) and every press (`pa`), and sends a `STATE` whenever the lock or the marked
team changes. A press is sent again every 30 ms until it is acknowledged; the server takes each press number once.

Presses that arrive within 50 ms of each other are compared by `ts`. The buzzer follows the server's clock (`st`) from
the heartbeat answers, as NTP does: the sample with the shortest round trip wins (`lib/buzzer_core/clock_sync.*`). So a
press that took longer over the WiFi still wins if it was first.

USB, text lines at 115200 baud (BuzzUI `server/services/buzzer-provisioning.service.ts`):

```
box → buzzer   BUZZ HELLO
buzzer → box   BUZZ READY <MAC> <firmware version> {"ssid":…,"host":…,"port":…,"color":…}
               (also when it starts; the WiFi it has, never the passphrase, or {} without one)
box → buzzer   BUZZ WIFI {"ssid":…,"pass":…,"host":…,"port":…,"color":…}
buzzer → box   BUZZ OK | BUZZ ERROR <reason>
```

`color` is the color of the case, `#rrggbb` (since firmware 1.2.0). It is optional in `BUZZ WIFI`: without it the
buzzer keeps the color it has, `""` takes it away, and anything else is refused (`BUZZ ERROR`). The buzzer leaves it
out of `BUZZ READY` and the heartbeat while it has none. Older firmware ignores it, so the box only sends it to 1.2.0
and later.

With the WiFi it has, the box shows a buzzer that already has its WiFi as adopted, and one that is connected to it
right now as connected.

On the Feather ESP32-S3, the serial connection is the ESP32-S3's own USB: lines only go out while a program has the
port open (DTR). The box doesn't reset it to wake it (RTS doesn't reach its reset, and with DTR off it would stop
sending), see `wakeUsbIds` in BuzzUI.

On the Feather V2, the buzzer only uses the serial connection while USB is plugged in. Without USB the Feather's USB serial chip
(CH9102) has no power, and an ESP32 that kept its serial output (TX) high would power it halfway through that line: the
chip then didn't show up on the computer when USB was plugged in, as long as the buzzer was awake on its battery. So the
ESP32 leaves TX alone until it sees the chip's output (its RX, GPIO 3) high, and lets go of it again when RX stays low.

The settings and the color are kept in the flash (`Preferences`, namespace `buzzer`). To give a buzzer another network by hand, e.g.
for a dev server on your computer, send those lines in a serial terminal.

## Code

- `src/main.cpp` — setup and loop: WiFi, UDP, USB, sleep
- `src/button.*` — a button: the interrupt takes the time of the press, `poll()` debounces it
- `src/usb_link.*` — serial over USB, only while USB is plugged in (see below)
- `src/battery.*` — the battery: the voltage divider of the Feather V2, the fuel gauge of the Feather ESP32-S3
- `src/indicator.*` — the NeoPixel and the light
- `include/config.h` — pins (for each board) and timings
- `lib/buzzer_core/` — the logic without hardware, tested natively: `clock_sync` (the server's clock), `power_policy`
  (when to sleep) and `messages` (the JSON packets)
