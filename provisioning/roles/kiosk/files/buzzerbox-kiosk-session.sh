#!/bin/bash
# The browsers of the kiosk, started by sway (sway.conf): the screen on HDMI and, on a box with a touch display
# (TOUCH_DISPLAY in buzzerbox.txt), the master on that display, with an on-screen keyboard. Each one is started again
# when it exits.

set -uo pipefail

KIOSK_FILE="/etc/buzzerbox/kiosk.conf"
MASTER_URL="http://buzzer.box/master/"
TOUCH_DISPLAY_ROTATION=90

log() {
  echo "buzzerbox-kiosk: $*" >&2
}

# written by buzzerbox-apply-settings from buzzerbox.txt, which anyone can edit, so it is read rather than sourced
if [ -f "${KIOSK_FILE}" ]; then
  while IFS='=' read -r key value; do
    case "${key}" in
      MASTER_URL) MASTER_URL="${value}" ;;
      TOUCH_DISPLAY_ROTATION) TOUCH_DISPLAY_ROTATION="${value}" ;;
    esac
  done < "${KIOSK_FILE}"
fi

# e.g. "HDMI-A-1" and "DSI-1". HDMI is there even without a TV, since the kernel command line forces it on (roles/base).
OUTPUTS="$(swaymsg -t get_outputs -p | sed -n 's/^Output \([^ ]*\) .*/\1/p')"
TOUCH_OUTPUT="$(grep -m 1 '^DSI-' <<< "${OUTPUTS}")"
SCREEN_OUTPUT="$(grep -m 1 '^HDMI-' <<< "${OUTPUTS}" || grep -m 1 -v '^DSI-' <<< "${OUTPUTS}")"
log "Outputs: ${OUTPUTS//$'\n'/ }; the screen goes on ${SCREEN_OUTPUT:-none}, the master on ${TOUCH_OUTPUT:-none}"

# Runs a browser on an output, again and again. It gets a workspace of its own on that output, and sway puts its window
# there by its process ID.
# name::string: names the workspace and the cache
# output::string
# ... Chromium's flags, the URL included
runBrowser() {
  local name="$1" output="$2" profile="" pid arg
  shift 2
  for arg in "$@"; do
    if [[ "${arg}" == --user-data-dir=* ]]; then
      profile="${arg#--user-data-dir=}"
    fi
  done
  profile="${profile:-${HOME}/.config/chromium}"
  while true; do
    # after a power cut, Chromium would offer to restore the last session
    if [ -f "${profile}/Default/Preferences" ]; then
      sed -i -e 's/"exited_cleanly":false/"exited_cleanly":true/' -e 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
        "${profile}/Default/Preferences"
    fi
    swaymsg "workspace ${name} output ${output}; workspace ${name}" > /dev/null
    # the cache is in /tmp (a tmpfs), so it doesn't wear the eMMC and starts empty after every boot. 64 MB, as videos
    # are cached too.
    /usr/bin/chromium \
      --ozone-platform=wayland \
      --noerrdialogs --disable-infobars --no-first-run --password-store=basic --disable-restore-session-state \
      --disk-cache-dir="/tmp/buzzerbox-${name}-cache" --disk-cache-size=67108864 \
      "$@" &
    pid=$!
    swaymsg "assign [pid=${pid}] workspace ${name}" > /dev/null
    wait "${pid}"
    log "The browser of the ${name} exited, starting it again"
    sleep 2
  done
}

if [ -n "${SCREEN_OUTPUT}" ]; then
  # the default profile, so that it keeps what the screen stored before there was a master on the box
  runBrowser screen "${SCREEN_OUTPUT}" --kiosk --autoplay-policy=no-user-gesture-required http://localhost/screen/ &
fi

if [ -n "${TOUCH_OUTPUT}" ]; then
  # The display is portrait by itself. Turning it doesn't turn its touch input, so libinput turns that by the same
  # angle (its calibration matrices for clockwise rotations).
  case "${TOUCH_DISPLAY_ROTATION}" in
    90) TRANSFORM=90 MATRIX="0 -1 1 1 0 0" ;;
    180) TRANSFORM=180 MATRIX="-1 0 1 0 -1 1" ;;
    270) TRANSFORM=270 MATRIX="0 1 0 -1 0 1" ;;
    *) TRANSFORM=normal MATRIX="1 0 0 0 1 0" ;;
  esac
  swaymsg "output ${TOUCH_OUTPUT} transform ${TRANSFORM}" > /dev/null
  swaymsg "input type:touch map_to_output ${TOUCH_OUTPUT}; input type:touch calibration_matrix ${MATRIX}" > /dev/null

  # It shows itself when a text field gets the focus, see roles/kiosk/tasks/main.yml. It takes the bottom of the
  # display, and the master's window gets smaller, so that the field stays visible.
  while true; do
    squeekboard
    log "The on-screen keyboard exited, starting it again"
    sleep 2
  done &

  # Under the hostname, not localhost: the master stores media as full URLs on the host it was opened under, which
  # other devices load too. Its sound would play twice, since the screen plays it as well. The browser is an app window
  # rather than in kiosk mode: a fullscreen window would hide the on-screen keyboard.
  runBrowser master "${TOUCH_OUTPUT}" \
    --user-data-dir="${HOME}/.config/buzzerbox-master" \
    --mute-audio --disable-pinch --overscroll-history-navigation=0 \
    --enable-wayland-ime --wayland-text-input-version=3 \
    --app="${MASTER_URL}" &
fi

wait
