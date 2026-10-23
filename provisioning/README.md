# BuzzerBox provisioning

Everything that turns a Raspberry Pi 4 / Compute Module 4 into a BuzzerBox is described here as code. The result is a
disk image that is the same on every box. You flash it onto an SD card or the CM4's eMMC, and each box then reads its
own settings (such as the WiFi name and password) from a file on the boot partition.

- `site.yml` and `roles/` hold the Ansible playbook that sets up the box. It is idempotent, so it can also run against
  boxes that are already in use.
- `group_vars/all.yml` has the settings and the pinned versions (Node.js, display mode, defaults of the per-box
  settings).
- `image/` builds the image: `base-image.env` pins the Raspberry Pi OS Lite image (64-bit, Trixie) by URL and checksum,
  and `build-image.sh` runs the playbook in a chroot of it.
- `.github/workflows/pi-image.yml` builds the image on GitHub. Pull requests that touch the setup only check that it
  builds; tags `v*` attach the image to their release.

## What runs on the box

| Part | Done by |
|---|---|
| Game server | `buzzerbox-server.service` (Node.js 24 from nodejs.org), in the release layout of the USB updates |
| Client | nginx serves `current/frontend` |
| Screen | `buzzerbox-kiosk.service`: Chromium in kiosk mode on HDMI, in the Wayland compositor `sway` on tty1, without a desktop |
| Touch display | with `TOUCH_DISPLAY` set, the master in a second Chromium on the display, with the on-screen keyboard `squeekboard` (`buzzerbox-kiosk-session`) |
| WiFi access point | a NetworkManager connection with DHCP (`.50`–`.150`) and DNS for the hostnames, written by `buzzerbox-settings.service` |
| USB sticks | `udiskie` mounts them at `/media/pi/<label>`, as before |
| Splash screen | `splashscreen.service` (fbi), until the kiosk starts |
| Buzzers | the GPIO UART `/dev/ttyS0` (`enable_uart=1`, no serial console) |
| Wireless buzzers | UDP over the access point; plugged in over USB and adopted on the master's home page, they get the WiFi from `/etc/buzzerbox/wireless-buzzers.conf`, which `buzzerbox-settings.service` writes |
| SSH | off, unless there are keys: built into the image (`ssh_authorized_keys`) or in `buzzerbox-ssh-keys.txt` on the boot partition |

## Building the image

You need Docker. You also need Node.js, which builds the client and the server.

```sh
cp config.dev.json.example config.dev.json   # once, the builds import it
provisioning/image/build.sh
```

This writes `provisioning/image/out/buzzerbox-<version>-<commit>.img.xz`, along with its checksum and a list of the
installed packages. Options:

- `--skip-compile` uses `install/.assets/compilations` as it is, instead of building the client and the server again.
- `--vars <file>` passes Ansible variables, e.g. to turn on SSH:
  ```yaml
  ssh_authorized_keys:
    - ssh-ed25519 AAAA... you@laptop
  ```

If `install/.assets/update-public-key.pem` exists, it goes into the image. Without it, the box can't install updates
(see the main README).

The build runs natively on an arm64 machine (Apple Silicon, or the arm64 GitHub runner). On x86-64, register arm64
emulation first: `docker run --privileged --rm tonistiigi/binfmt --install arm64`.

The packages the playbook installs come from the live Raspberry Pi OS/Debian repositories at build time. The base image
and Node.js are pinned. The `.packages.txt` file next to each image records exactly what went in.

## Flashing

**SD card (Raspberry Pi 4, CM4 Lite):** write the `.img.xz` with the Raspberry Pi Imager (*Choose OS → Use custom*;
skip the OS customisation, the box ignores it), balenaEtcher or
`xz -dc buzzerbox-….img.xz | sudo dd of=/dev/<card> bs=4M conv=fsync`.

**eMMC (CM4):**
1. Put the CM4 in USB boot mode. On the CM4 IO Board, fit the jumper *Fit jumper to disable eMMC Boot* (J2, nRPIBOOT).
   Then connect the USB slave port (J11) to your computer and power the board.
2. Run `rpiboot` from [usbboot](https://github.com/raspberrypi/usbboot) (`brew install rpiboot` on macOS, or build it
   from source). The eMMC then shows up as a USB drive.
3. Write the image onto that drive as for an SD card. Then remove the jumper and power the board again.

## Per-box settings

The boot partition (`bootfs`, which any computer can read) holds `buzzerbox.txt`:

```
WIFI_SSID=BuzzerBoxNetwork
WIFI_PASSPHRASE=12TheBuzzerBox_IncredibleNetwork34
WIFI_COUNTRY_CODE=DE
WIFI_CHANNEL=8
WIFI_ANTENNA=internal
SERVER_IP_ADDRESS=10.0.0.5
SERVER_HOSTNAMES=buzzer.box buzzerbox.local
TOUCH_DISPLAY=none
TOUCH_DISPLAY_ROTATION=90
```

Edit it after flashing, or later by putting the card back into a computer (for the eMMC, use `rpiboot` again). The box
applies it on every start (`roles/access_point/files/buzzerbox-apply-settings.sh`). Missing or invalid values fall back
to the defaults in `group_vars/all.yml`, and `journalctl -u buzzerbox-settings` shows why a value was ignored. **Give
every box its own WiFi password**: the default one is public in this repository.

`WIFI_ANTENNA=external` switches a CM4 to the antenna on its U.FL connector (`dtparam=ant2` in `config.txt`). The
firmware only reads `config.txt` at boot, so when the setting changes, the box restarts once by itself. A Raspberry Pi 4
has no antenna connector and ignores the setting.

`TOUCH_DISPLAY` (`5inch`, `7inch` or `10inch`) is for a Raspberry Pi Touch Display 2 on the DSI connector `DISP1`; the
10" one needs that connector's four lanes. The box then shows the master on the display and the screen on HDMI. Another
device can still take over the master, and the display can take it back on its page "Steuerung zurückholen". Like the
antenna, the display is set in `config.txt`, so the box restarts once by itself when it changes.
`TOUCH_DISPLAY_ROTATION` turns the picture clockwise (the touch input turns with it); the display is portrait by itself.

### SSH access

SSH is off on the images from GitHub. To log into a box, put your public key (e.g. `~/.ssh/id_ed25519.pub`) into
`buzzerbox-ssh-keys.txt` on the same boot partition, one key per line, and restart the box. Then join its WiFi and
log in as the admin user, who may use `sudo` (`10.0.0.5` unless `buzzerbox.txt` sets another `SERVER_IP_ADDRESS`):

```sh
ssh admin@10.0.0.5
```

The box takes the keys on every start (`roles/ssh/files/buzzerbox-apply-ssh-keys.sh`), and `journalctl -u
buzzerbox-ssh-keys` shows which keys it took and why lines were ignored. Only public keys are taken, and passwords are
never accepted. Remove the keys and restart the box to turn SSH off again. Anyone who can write to the card can turn
SSH on this way, but they could change the box in any other way as well.

Images built with `ssh_authorized_keys` (see above) have their keys built in, in addition to the ones on the card.

## Changing boxes that are in use

Boxes built with SSH keys can be updated over their WiFi with the same playbook: copy `inventory.example.yml` to
`inventory.yml` and run `ansible-playbook -i inventory.yml site.yml` from this directory. It needs Ansible with the
`community.general` and `ansible.posix` collections. The BuzzerBox software itself isn't changed this way: a box keeps
the release it runs, and newer releases come as USB update bundles.

## Moving to newer versions

- **Raspberry Pi OS:** change both lines in `image/base-image.env`.
- **Node.js:** change `node_version` and `node_sha256` in `group_vars/all.yml` (from `SHASUMS256.txt` of the
  release), and the version in the workflow.

## Differences from the old Buster installation (`install/`)

- The new Raspberry Pi OS has no LXDE desktop. Chromium runs in `sway` instead, so the old autostart, `unclutter`,
  `xdotool` and the desktop tweaks are gone.
- hostapd/dnsmasq/dhcpcd are replaced by NetworkManager's access point mode.
- Node.js 24 instead of 14, and 64-bit instead of 32-bit.
- The user `pi` has no password and no general sudo. Its only sudo rule is the one that starts updates.
- `install/install.sh` only works on Raspbian Buster. `install/enable-usb-updates.sh` is still needed for converting old
  boxes to USB updates.
