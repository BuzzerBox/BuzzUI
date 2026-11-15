# Operations

Releasing the software, building and installing updates, and looking into a box. Building and flashing the image of
a new box is described in [provisioning](../provisioning/README.md).

## Releases

A release has a version `X.Y.Z` in `version.json`, a tag `vX.Y.Z`, and two files on its GitHub release: the update
bundle for boxes in use and the image for new ones.

1. Create the branch `release/X.Y.Z` from `main`, raise `version.json` to `X.Y.Z`, and open a pull request
   "Release X.Y.Z" that lists the changes since the last release.
2. Squash-merge it.
3. Tag the merge commit with a signed, annotated tag, and push it:
   ```sh
   git tag -s vX.Y.Z -m "BuzzerBox X.Y.Z" <merge commit>
   git push origin vX.Y.Z
   ```
   The tag has to match `version.json`, or the workflows refuse it.

The tag starts two workflows. Whichever comes first creates the GitHub release (with generated notes), and both
attach their files:

| Workflow | Builds | For pull requests |
|---|---|---|
| `.github/workflows/update-bundle.yml` | `buzzerbox-update-X.Y.Z.tar`, signed with the key of the `update-signing` environment | Checks that a bundle builds, signed with a throwaway key no box accepts |
| `.github/workflows/pi-image.yml` | `buzzerbox-X.Y.Z-<commit>.img.xz`, its checksum and package list, on an arm64 runner | Checks that the image builds, if the PR touches `provisioning/` or `install/.assets/` |
| `.github/workflows/test-images.yml` | The Docker images of the [test environment](#test-environment), on every push to `main` | – |

## Update bundles

An update bundle `buzzerbox-update-<version>.tar` holds `manifest.json` (the version and the checksum of the
payload), its signature `manifest.sig`, and `payload.tar.gz`: the built client (`frontend/`), the server with its
`node_modules` (`backend/`, since the box has no internet) and `hooks/`.

**Building one by hand:**

```sh
cp config.dev.json.example config.dev.json   # once, the builds import it
# raise version.json first
scripts/create-update-bundle.sh <private-key.pem>   # or BUZZERBOX_UPDATE_SIGNING_KEY=<file>
scripts/create-update-bundle.sh --unsigned          # to try a build on a box
```

The bundle lands in `updates/`. The script refuses to sign with a key that doesn't belong to
`install/.assets/update-public-key.pem` (or `BUZZERBOX_UPDATE_PUBLIC_KEY`), so it never makes a bundle the boxes
would refuse.

### Signing

Bundles are signed with an Ed25519 key. The key pair was created once with

```sh
node scripts/update-signing.js generate-key <private-key.pem> install/.assets/update-public-key.pem
```

The public key is in the repository; images and updates put it at `/etc/buzzerbox/update-public-key.pem`. **The private
key is never in the repository.** It is the secret `BUZZERBOX_UPDATE_SIGNING_KEY` of the GitHub environment
`update-signing`, which only `v*` tags may deploy to. To set it up again (*Settings → Environments*):

```sh
gh secret set BUZZERBOX_UPDATE_SIGNING_KEY --env update-signing < <private-key.pem>
```

Anyone who can push a `v*` tag can have a bundle signed, so restrict who may create those tags (a tag ruleset), or add
required reviewers to the environment.

### Bundles without a valid signature

The master marks bundles that are unsigned, signed with another key, or found on a box without a public key, and
installs one only after the host confirms a big warning. Over SSH it takes `--allow-unsigned`. The checksum and the
version are still checked. An update runs as root, so this lets anyone who can open the master page install any
software on the box. To turn it off on a box, create `/etc/buzzerbox/require-signed-updates`.

### How a box installs one

- The software is in `/home/pi/BuzzerBox/releases/<version>`, and `/home/pi/BuzzerBox/current` links to the one that
  runs. nginx serves `current/frontend`, and `buzzerbox-server.service` runs `current/backend`.
- While **no game is set up**, the server looks for bundles in the `updates` folder at the top of each USB stick
  (`<stick>/updates/buzzerbox-update-<version>.tar`; see `update` in the [configuration](configuration.md)). Bundles
  elsewhere on the stick are not found, and the sticks are left alone during a game.
- The master shows the installed version and the bundles it found on its home page. *Install* makes the server start
  `sudo -n /usr/local/sbin/buzzerbox-update start <bundle>` (`install/.assets/scripts/buzzerbox-update.sh`). The helper
  runs as its own systemd unit, since it restarts the server.
- The helper checks the signature, the checksum and the version, unpacks the release, switches `current` to it, runs
  its `hooks/post-install.sh` (which brings the update helper and the server's service of the new version onto the
  box; they stay on a rollback, so they must keep working with older versions) and restarts the server. If the new server doesn't answer within 60 s, it
  switches back by itself. It keeps the last three releases.
- It reports to `/var/lib/buzzerbox/update-status.json`, which the server reads again after the restart. Screens
  reload by themselves; the master offers to reload.
- Updates need a writable root file system, so they are refused while the overlay file system of `raspi-config` is on.

### On the command line

Over [SSH](#ssh):

```sh
sudo buzzerbox-update install <bundle>                    # install and wait for the result
sudo buzzerbox-update install --allow-unsigned <bundle>
sudo buzzerbox-update rollback                            # back to the previous release
buzzerbox-update status                                   # the result of the last update
sudo buzzerbox-update recover                             # mark an update cut off (e.g. by a power cut) as failed
```

To update a box from a computer: download `buzzerbox-update-<version>.tar` from the GitHub release, join the box's
WiFi, then

```sh
scp buzzerbox-update-X.Y.Z.tar admin@10.0.0.5:
ssh admin@10.0.0.5 sudo buzzerbox-update install buzzerbox-update-X.Y.Z.tar
```

The box's clock lags (it has no battery-backed clock), so tar's warnings about time stamps in the future are harmless.

### Boxes from before USB updates

Boxes installed with the old `install/install.sh` (Raspbian Buster) run the server from the desktop's autostart and
have no update helper. Copy `install/` (with `.assets/update-public-key.pem`) onto such a box and run
`sudo ./enable-usb-updates.sh` once. It moves the installed software to `releases/legacy` and sets up the
`buzzerbox-server` service, the update helper and its sudo rule. Then install the first bundle by hand:
`sudo buzzerbox-update install /media/pi/<stick>/updates/buzzerbox-update-<version>.tar`.

Such a box keeps its old system (Buster, LXDE, hostapd). To bring it to the current one, flash the
[image](../provisioning/README.md).

## SSH

SSH is off unless the box has keys, see [provisioning](../provisioning/README.md#ssh-access): put your public key into
`buzzerbox-ssh-keys.txt` on the boot partition and restart the box. Then join its WiFi and log in as **`admin`**,
who has passwordless sudo:

```sh
ssh admin@10.0.0.5        # or the SERVER_IP_ADDRESS of buzzerbox.txt
```

Only keys are accepted. The user `pi` runs the server and the kiosk, but can't log in over SSH, and its only sudo
rule is starting the update helper.

## What runs, and its logs

| Unit | What it does | Log |
|---|---|---|
| `buzzerbox-server` | The game server | `journalctl -u buzzerbox-server -f` |
| `buzzerbox-kiosk` | Chromium in `cage` on the TV, at `http://localhost/screen/` | `journalctl -u buzzerbox-kiosk` |
| `buzzerbox-settings` | Applies `buzzerbox.txt` at every start, see the [box settings](box-settings.md) | `journalctl -u buzzerbox-settings` |
| `buzzerbox-ssh-keys` | Takes the SSH keys from the boot partition | `journalctl -u buzzerbox-ssh-keys` |
| `buzzerbox-automount` | Mounts USB sticks at `/media/pi/<label>` | `journalctl -u buzzerbox-automount` |
| `nginx` | Serves the client on port 80 | `/var/log/nginx/` |
| `NetworkManager` | The access point, Ethernet, DHCP and DNS | `journalctl -u NetworkManager` |

Other places worth knowing:

| Path | What |
|---|---|
| `/var/lib/buzzerbox/storage/games/` | The box's games |
| `/var/lib/buzzerbox/update-status.json` | The result of the last update |
| `/etc/buzzerbox/` | The applied settings (`box.conf`, `wireless-buzzers.conf`, `hosts`, `settings.defaults`), the update key |
| `/boot/firmware/buzzerbox.txt` | The box's settings, on the boot partition |

## Test environment

`deploy/test/` runs the latest `main` in Docker, so changes can be tried without a box. On every push to `main`,
`test-images.yml` builds `server/docker/Dockerfile` and `client/docker/Dockerfile` (build context: the repository root)
and publishes them as `ghcr.io/buzzerbox/buzzui-server:test` and `ghcr.io/buzzerbox/buzzui-client:test`.

The images run the production code, with `config.test.json` merged into `config.json` at build time
(`scripts/merge-config.js`): the browser's number keys are buzzers, the serial port and updates are off, and media
come from `/srv/media`. See the [configuration layers](configuration.md#layers).

On the test host:

1. Copy `deploy/test/` there, put media into `media/<stick>/` (every folder in `media/` is a stick) and create `.env`
   from `.env.example` (the site address and the shared login).
2. `docker compose up -d`.
3. Run `update.sh` from cron, e.g. every five minutes:
   `*/5 * * * * cd /opt/buzzerbox-test && ./update.sh >> update.log 2>&1`. It pulls new images, recreates the
   containers whose image changed, and also takes the `Caddyfile` and `docker-compose.yml` from `main`.
4. For an example game, import `example-game/Beispielspiel.json` under *Manage games*.

Only Caddy is reachable from outside (ports 80 and 443): it asks for the login and forwards `/ws` and `/media*` and
`/storage*` to the server, and everything else to the client. **Restarting the server ends a running game**, since the
game state is in memory.
