# BuzzUI
WebApp for the BuzzerBox

## Installation
How to install the BuzzerBox web app onto a platform. Currently, only the Raspberry Pi 4 with the OS `Buster` is
supported. Various things can be set in the `setup.env` file in the installation directory root.
The supported settings are shown below:

- `INSTALL_DIR`: Sets the target location the BuzzerBox web app is to be installed to. Defaults to `/home/pi/BuzzerBox`.
- `WIFI_SSID`: Sets the Pi's ad-hoc WiFi network's SSID. Defaults to `BuzzerBoxNetwork`.
- `WIFI_COUNTRY_CODE`: Sets the Pi's ad-hoc WiFi network's country code. Defaults to `DE`.
- `WIFI_PASSPHRASE`: Sets the Pi's ad-hoc WiFi network's passphrase. Defaults to `12TheBuzzerBox_IncredibleNetwork34`.
- `SERVER_IP_ADDRESS`: Sets the Pi's own IP address within its ad-hoc WiFi network. Defaults to `10.0.0.5`.
- `HOSTNAMES`: Sets the hostnames under which the Pi can be found. Multiple values are supported by concatenating them with a `;`. Defaults to `buzzer.box;buzzerbox.local`.
- `SPLASH_IMAGE_TARGET_LOCATION`: Sets the location where is splash image that is used during boot-up and as desktop wallpaper will be saved to. Defaults to `/home/pi/Pictures/splash.png`.
- ⚠NOT YET IMPLEMENTED⚠ `ACTIVATE_OVERLAY_FS`: Whether the overlay FS should automatically get enabled by the installation procedure. Defaults to `true`



### Raspberry Pi 4 `Buster`

## Updating a BuzzerBox
A BuzzerBox installs updates from a USB stick. Put the update bundle `buzzerbox-update-<version>.tar` on a stick (at
the top level or in any folder), plug it into the box and open the master page. While no game is set up, the first
setup step shows the installed version and the bundles on the stick; *Installieren* installs one. The box checks the
bundle's signature, switches to the new version and restarts the server. If the new version does not start, it goes
back to the previous one on its own. Screens reload by themselves; the master page offers to reload.

Over SSH, `sudo buzzerbox-update install <bundle>`, `sudo buzzerbox-update rollback` and `buzzerbox-update status` do
the same by hand.

### Building an update bundle
1. Raise the version in `version.json`.
2. Run `scripts/create-update-bundle.sh <private-key.pem>`. It builds the client and the server (with the server's
   `node_modules`, since the box has no internet) and writes the signed bundle to `updates/`.

Bundles are signed with an Ed25519 key. Create the key pair once with
`node scripts/update-signing.js generate-key <private-key.pem> install/.assets/update-public-key.pem`, keep the private
key out of the repository and commit the public key: installations copy it to `/etc/buzzerbox/update-public-key.pem`
and refuse bundles without a matching signature.

### Boxes installed before USB updates
Older installations run the server from the desktop autostart and have no update helper. Copy the `install/` directory
(with `.assets/update-public-key.pem`) onto the box and run `sudo ./enable-usb-updates.sh` once. It moves the installed
software to `releases/legacy`, sets up the `buzzerbox-server` service, the update helper and its sudo rule. Then install
the first bundle by hand: `sudo buzzerbox-update install /media/pi/<stick>/buzzerbox-update-<version>.tar`.

### How it works
The software lives in `${INSTALL_DIR}/releases/<version>`, and `${INSTALL_DIR}/current` links to the release that runs:
nginx serves `current/frontend` and the systemd service `buzzerbox-server` runs `current/backend`. The server looks for
bundles in `fileServer.localPath` and the folders right below it (`update` in `config.json`) and starts
`/usr/local/sbin/buzzerbox-update` (`install/.assets/scripts/buzzerbox-update.sh`) through sudo. The helper runs as its
own systemd unit, since it restarts the server, and reports to `/var/lib/buzzerbox/update-status.json`, which the
server reads again after the restart. Each bundle's `hooks/post-install.sh` also brings the helper and the service of
the new version onto the box. Updates need a writable root file system, so they are refused while the overlay file
system is active.

## Configuration of the web app
TODO probably needs to be updated
```json
{
  "gameName": <NAME>,
  "masterName": <NAME>,
  "screenName": <NAME>,
  "server": <SHOULD NOT BE CHANGED>
  "buzzers": [
    {
      "name": "Buzzer 1",
      "key": "Numpad0"
    }
    ...
    {
      "name": "Buzzer 5",
      "key": "Numpad4"
    }
  ],
  "i2c": {
    "addresses": {
     "microController": "25"
    },
    "commands": {
     "softRelease": "1",
     "setBuzzer": "2"
   }
  }
}
```
The following key-bindings are available so far: `NUMPAD_0`, `NUMPAD_1`, `NUMPAD_2`, `NUMPAD_3`, `NUMPAD_4`, `NUMPAD_5`, `NUMPAD_6`, `NUMPAD_7`, `NUMPAD_8`, `NUMPAD_9`.

## Media files
Media for the questions is read from USB sticks plugged into the Pi. Supported file types:

- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`, `.avif`
- Video: `.mp4`, `.m4v`, `.webm`
- Audio: `.mp3`, `.wav`, `.ogg`, `.m4a`

The file extension says little about whether a video plays smoothly on the Pi; what counts is the codec inside.
The Pi can only decode **H.264** in hardware, so use H.264 video with AAC audio in an `.mp4` file, at most 1080p
and 30 fps. `.webm` files (VP8/VP9) are decoded by the CPU and only play smoothly up to 720p. HEVC/H.265 (common
for iPhone recordings), AV1 and 4K videos usually won't play, or will stutter.

To convert any video into a file that plays reliably, use [ffmpeg](https://ffmpeg.org/):

```shell
ffmpeg -i input.mov -c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p \
  -vf "scale='min(1920,iw)':-2" -c:a aac -b:a 160k -movflags +faststart output.mp4
```

This scales videos wider than 1920 px down to 1080p and keeps smaller ones as they are. Always test a video on the
BuzzerBox itself before a game.

## WiFi
WiFi default name's `BuzzerBoxNetwork` and the default password is `12TheBuzzerBox_IncredibleNetwork34`, but these can
be set in `setup.env`.

## Disable Screen Saver
To disable the screen saver, use the `raspi-config` and disable the screen blanking
