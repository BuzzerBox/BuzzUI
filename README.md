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
A BuzzerBox installs updates from a USB stick. Create a folder named `updates` at the top level of the stick, put the
update bundle `buzzerbox-update-<version>.tar` into it (`<stick>/updates/buzzerbox-update-<version>.tar`), plug the
stick into the box and open the master page. Bundles anywhere else on the stick are not found. While no game is set up, the first
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
and warn before installing bundles without a matching signature.

### Bundles without a valid signature
`scripts/create-update-bundle.sh --unsigned` builds a bundle without a signature, e.g. to try a build on a box. The
master marks bundles without a valid signature (unsigned, signed with another key, or the box has no public key) and
installs one only after a big warning that the user has to confirm; over SSH it takes
`sudo buzzerbox-update install --allow-unsigned <bundle>`. The checksum and the version are still checked. An update
runs as root, so this lets anyone who can open the master page install any software on the box. To turn it off on a
box, create the file `/etc/buzzerbox/require-signed-updates`.

#### Built by GitHub
The *Update bundle* workflow (`.github/workflows/update-bundle.yml`) builds the signed bundle for every tag `v<version>`
and attaches it to the tag's GitHub release, next to the SD card image. To release:
1. Raise the version in `version.json` and merge it into `main`.
2. Tag the commit and push the tag: `git tag v1.2.0 && git push origin v1.2.0`. The tag has to match `version.json`.

Pull requests check that a bundle builds, signed with a throwaway key that no box accepts. The workflow refuses to sign
a bundle if the key does not belong to `install/.assets/update-public-key.pem`.

The private key lives in the secret `BUZZERBOX_UPDATE_SIGNING_KEY` of the GitHub environment `update-signing`. Set it
up once under *Settings → Environments*: create `update-signing`, limit its deployment branches and tags to the tag
pattern `v*` and add the secret with the contents of the private key file, e.g.
`gh secret set BUZZERBOX_UPDATE_SIGNING_KEY --env update-signing < <private-key.pem>`. Anyone who can push a `v*` tag
can then sign a bundle, so restrict who may create those tags (a tag ruleset), or add required reviewers to the
environment so that each signing waits for an approval.

### Boxes installed before USB updates
Older installations run the server from the desktop autostart and have no update helper. Copy the `install/` directory
(with `.assets/update-public-key.pem`) onto the box and run `sudo ./enable-usb-updates.sh` once. It moves the installed
software to `releases/legacy`, sets up the `buzzerbox-server` service, the update helper and its sudo rule. Then install
the first bundle by hand: `sudo buzzerbox-update install /media/pi/<stick>/updates/buzzerbox-update-<version>.tar`.

### How it works
The software lives in `${INSTALL_DIR}/releases/<version>`, and `${INSTALL_DIR}/current` links to the release that runs:
nginx serves `current/frontend` and the systemd service `buzzerbox-server` runs `current/backend`. The server looks for
bundles in the `updates` folder of each stick, i.e. in `<fileServer.localPath>/<stick>/updates` (`update` in
`config.json`), and only while no game is set up, so it leaves the sticks alone during a game. It starts
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

## Games and media
Supported media file types:

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

The master's start page has three entries: *Spiel erstellen* (the editor), *Spiel starten* and *Spiele & Medien*.

A game is a folder, on the box or on a USB stick:

```
games/<Name>/                      on the box: <storage.boxPath>/games (default /var/lib/buzzerbox/storage/games)
  versions/1.json, 2.json, …       on a USB stick: <stick>/buzzerbox-games
  states/<Name>.json
  media/
```

- **Versions:** saving in the editor adds a new version, if anything changed. Versions are never changed afterwards.
- **States:** each time a game is played gets a state with its teams and progress, which plays the version it was
  started with. *Spiel starten* lists the states to continue them, or starts a new one with the latest version. The
  server saves the state automatically while the game is played; the toolbar shows when it was saved last.
- **Media:** a game's media are in its `media/` folder, and its questions refer to them by paths relative to it, so a
  game can be copied between the box and a stick as a whole. Media are uploaded from the master's device or copied
  from a USB stick in the editor and in *Spiele & Medien*. Media that a version shows can't be deleted.
- **Files on the device:** a game, or a game with a state, can be downloaded as one JSON file (without the media) and
  imported again. Old savegames (downloaded before games were stored on the box) are imported the same way; their
  media are copied into the new game if the USB stick with them is plugged in.
- Only media are served from the game folders, not the versions and states, which hold the answers. Only the master
  can use the storage: the server hands it a token over the WebSocket, which the storage API (`/storage` on the media
  port, see `shared/helper/storage-api.helper.ts`) checks.

Every folder in `fileServer.localPath` (`/media/pi` on the box, where the sticks are mounted) is a USB stick. For local
development, `config.dev.json.example` sets it to `server/media`, so each folder in it stands for one stick:

```
server/media/DevStick/             a stick named "DevStick"
  buzzerbox-games/                 its games
  Audio/, Bilder/, …               its other media, which can be copied into a game
```

## WiFi
WiFi default name's `BuzzerBoxNetwork` and the default password is `12TheBuzzerBox_IncredibleNetwork34`, but these can
be set in `setup.env`.

## Disable Screen Saver
To disable the screen saver, use the `raspi-config` and disable the screen blanking
