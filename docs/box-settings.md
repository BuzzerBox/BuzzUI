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

The firmware only reads `config.txt` at boot, so when the antenna changes on a Compute Module 4, the box **restarts
once by itself**.

## What does not follow these settings

- The WiFi name and address that the waiting screen and the start page show come from `join` in `config.json`, which
  is built into the client. A box with another `WIFI_SSID` or hostname still shows the built-in ones.
- Wireless buzzers keep the WiFi they were given. After changing `WIFI_SSID`, `WIFI_PASSPHRASE` or
  `SERVER_IP_ADDRESS`, adopt them again over USB.

## SSH keys

`buzzerbox-ssh-keys.txt` on the same partition turns SSH on, see [provisioning](../provisioning/README.md#ssh-access).
