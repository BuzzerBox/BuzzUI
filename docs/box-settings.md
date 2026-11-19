# Box settings reference

Each box has its own settings in **`buzzerbox.txt` on its boot partition** (`bootfs`), which any computer can read
and write: put the SD card into a computer, or use `rpiboot` for a Compute Module's eMMC. The lines are `KEY=value`
without quotes. For hosts, the [user guide](user/box-settings-and-updates.md) explains how to change them.

## Keys

| Key | Default | Valid values | Meaning |
|---|---|---|---|
| `WIFI_SSID` | `BuzzerBoxNetwork` | 1–32 bytes | The name of the box's WiFi. |
| `WIFI_PASSPHRASE` | `12TheBuzzerBox_IncredibleNetwork34` | 8–63 printable characters | Its password. **Give every box its own**: the default is public in this repository. |
| `WIFI_COUNTRY_CODE` | `DE` | two letters | The country the box is used in, which decides the allowed channels. |
| `WIFI_CHANNEL` | `8` | 1–13 | The WiFi channel. In the US, Canada and Taiwan, 12 and 13 become 11. |
| `WIFI_ANTENNA` | `internal` | `internal`, `external` | `external` uses the antenna connector of a Compute Module 4. A Raspberry Pi 4 has none and ignores it. |
| `ANALOG_BUZZERS` | `yes` | `yes`, `no` | `no` is for a box without buzzer ports: the master then only offers the wireless buzzers. |
| `SERVER_IP_ADDRESS` | `10.0.0.5` | an IPv4 address ending in 1–49 or 151–254 | The box's address in its WiFi. Devices get `.50` to `.150` of the same /24 network. |
| `ETHERNET_IP_ADDRESS` | `10.0.1.5` | as above, in another /24 network than the WiFi's | The box's address for a notebook on a cable, without a router in between. |
| `SERVER_HOSTNAMES` | `buzzer.box buzzerbox.local` | names separated by spaces | The names devices can open the box under. |
| `SCREEN_MODE` | `1920x1080@60` | `WIDTHxHEIGHT`, optionally `@HZ`, or `auto` | The resolution of the game screen on the HDMI port with the TV. Without `@HZ`, the rate closest to 60 is taken. `auto` is the TV's own choice, often 4K, which a Raspberry Pi 4 doesn't draw smoothly. The kiosk only sets modes the TV offers. |
| `TOUCH_DISPLAY` | `none` | `none`, `5inch`, `7inch`, `10inch` | A Raspberry Pi Touch Display 2 on `DISP1`, which then shows the master (the 10" one needs the connector's four lanes). The master's settings page only offers `10inch` and `none`. |
| `TOUCH_DISPLAY_ROTATION` | `270` | `0`, `90`, `180`, `270` | How far the touch display's picture is turned clockwise; the display is portrait by itself. |
| `TOUCH_DISPLAY_SCALE` | `auto` | `auto`, or 1 to 3 with up to two decimals | How large the master is drawn on the touch display. `auto` aims at about 150 pixels per inch (1.5 on the 5" and 10" display, 1.25 on the 7" one). |
| `EDIT_IN_MASTER` | `false` | `true`, `false` | `true` lets the master change these settings and the SSH keys, see [below](#in-the-master). Only the file can change it. |

A missing line, an empty value or an invalid value means the default. Unknown keys are ignored. The defaults come
from `provisioning/group_vars/all.yml` and are stored on the box in `/etc/buzzerbox/settings.defaults`.

## How the box applies them

`buzzerbox-settings.service` runs `buzzerbox-apply-settings` (`provisioning/roles/access_point/files/`) on **every
start**, before NetworkManager. So a change counts after a restart of the box. `journalctl -u buzzerbox-settings`
shows which values were ignored and why. If `buzzerbox.txt` is missing, the script writes one with the defaults.

From the settings, the script writes (only what changed):

| What | Where |
|---|---|
| The WiFi access point, with DHCP | `/etc/NetworkManager/system-connections/buzzerbox-ap.nmconnection` |
| The same for Ethernet | `…/buzzerbox-ethernet.nmconnection`; left off if both addresses are in the same network |
| The hostnames, for the devices | `/etc/buzzerbox/hosts`, read by NetworkManager's dnsmasq |
| The hostnames, for the box itself | `/etc/hosts`, on `127.0.0.1` |
| The WiFi the wireless buzzers are given | `/etc/buzzerbox/wireless-buzzers.conf` (readable by the group `dialout`), see `udpBuzzer.provisioning.settingsFile` |
| The game server's settings (`ANALOG_BUZZERS`) | `/etc/buzzerbox/box.conf`, see `boxSettingsFile`; the server reads it when it starts |
| The WiFi country | `iw reg set`, and `cfg80211.ieee80211_regdom` on the kernel command line |
| The antenna | a block in `config.txt` (`dtparam=ant2` under `[cm4]`) |
| The touch display | a block in `config.txt` (its overlay on `DISP1`) |

The firmware only reads `config.txt` at boot, so when the antenna changes on a Compute Module 4, or the touch display
changes, the box **restarts once by itself**. The kiosk reads `SCREEN_MODE` and the touch display's rotation and scale
when it starts, see [provisioning](../provisioning/README.md).

## In the master

The gear icon on the master's home page leads to `/master/settings` (`master/box-settings`), which shows the settings,
the box's hardware and the SSH keys. It is only there while no game is set up. The master asks for them with
`REQUEST_BOX_SETTINGS`, and `BoxSettingsService` reads the file (`boxSettings.file` in `config.json`) and fills in the
defaults (`boxSettings.defaultsFile`) for missing or invalid values, which the page marks.

With `EDIT_IN_MASTER=true`, the master can change them (`SAVE_BOX_SETTINGS`) and restart the box (`RESTART_BOX`), both
only while no game is set up. Only changed values are written, and the file keeps its comments and order. The server
can't write the boot partition, so it runs the root helper `buzzerbox-settings` (`install/.assets/scripts/buzzerbox-settings.sh`)
through sudo, which checks `EDIT_IN_MASTER` and every value again. The same values are checked in three places, which
have to stay the same: `BoxSettingsHelper` (`shared/`), the root helper and `buzzerbox-apply-settings`.

SSH keys can be added and removed there as well (`ADD_SSH_KEY`, `REMOVE_SSH_KEY`); they count right away. Private
keys, broken keys, options like `command=` and duplicates are refused.

Boxes made before `EDIT_IN_MASTER` don't have the line: add it by hand to allow editing. `box_settings_edit_in_master`
in `provisioning/group_vars/all.yml` sets it for new images. In dev (`boxSettings.useHelper: false`), the server writes
`server/box-storage/buzzerbox.txt` and `buzzerbox-ssh-keys.txt` itself, with editing allowed, and can't restart.

## What does not follow these settings

- The WiFi name and address that the waiting screen and the start page show come from `join` in `config.json`, which
  is built into the client. A box with another `WIFI_SSID` or hostname still shows the built-in ones.
- Wireless buzzers keep the WiFi they were given. After changing `WIFI_SSID`, `WIFI_PASSPHRASE` or
  `SERVER_IP_ADDRESS`, adopt them again over USB.

## SSH keys

`buzzerbox-ssh-keys.txt` on the same partition turns SSH on, see [provisioning](../provisioning/README.md#ssh-access).
