#!/bin/bash
# The browsers of the kiosk, started by sway (sway.conf): the screen on HDMI and, on a box with a touch display
# (TOUCH_DISPLAY in buzzerbox.txt), the master on that display, with an on-screen keyboard. Each one is started again
# when it exits. When this script ends, sway ends the session (sway.conf).

set -uo pipefail

KIOSK_FILE="/etc/buzzerbox/kiosk.conf"
MASTER_URL="http://buzzer.box/master/?touchDisplay=1"
TOUCH_DISPLAY_ROTATION=270
TOUCH_DISPLAY_SCALE=1
# The game screen's mode on the TV (SCREEN_MODE in buzzerbox.txt) rather than the TV's preferred one: that is often 4K,
# more than a Pi 4 draws smoothly, and the kernel's forced mode (roles/base) doesn't match what most TVs offer, so it
# falls back to the preferred one too.
SCREEN_MODE="1920x1080@60Hz"

log() {
  echo "buzzerbox-kiosk: $*" >&2
}

# Whether the sway of this session still runs. Stopping or restarting buzzerbox-kiosk.service ends sway, but not this
# script: logind keeps the session's processes in its own scope, outside the service. Without this check, the loops
# below would start their programs into the next session's sway, where they can't be placed (SWAYSOCK still names the
# old sway's socket), so a stray screen covered the master on the touch display.
isSwayRunning() {
  swaymsg -t get_version > /dev/null 2>&1
}

# written by buzzerbox-apply-settings from buzzerbox.txt, which anyone can edit, so it is read rather than sourced
if [ -f "${KIOSK_FILE}" ]; then
  while IFS='=' read -r key value; do
    case "${key}" in
      MASTER_URL) MASTER_URL="${value}" ;;
      TOUCH_DISPLAY_ROTATION) TOUCH_DISPLAY_ROTATION="${value}" ;;
      TOUCH_DISPLAY_SCALE) TOUCH_DISPLAY_SCALE="${value}" ;;
      SCREEN_MODE) [ -n "${value}" ] && SCREEN_MODE="${value}" ;;
    esac
  done < "${KIOSK_FILE}"
fi
# "1920x1080@60" from buzzerbox.txt, as sway wants it; "auto" leaves the mode to the TV
case "${SCREEN_MODE}" in
  auto) SCREEN_MODE="" ;;
  *@*Hz) ;;
  *@*) SCREEN_MODE="${SCREEN_MODE}Hz" ;;
esac

# output::string, e.g. "HDMI-A-2"
# -> 0 if a display is plugged into that port: its EDID can be read
hasDisplay() {
  local edid
  for edid in /sys/class/drm/card*-"$1"/edid; do
    if [ -r "${edid}" ] && [ "$(head -c 1 "${edid}" | wc -c)" -gt 0 ]; then
      return 0
    fi
  done
  return 1
}

# The HDMI outputs that sway has, switched off ones included, e.g. "HDMI-A-1" and "HDMI-A-2". HDMI-A-1 (HDMI0) is
# there even without a TV, since the kernel command line forces it on (roles/base).
hdmiOutputs() {
  swaymsg -t get_outputs -p | sed -n 's/^Output \(HDMI-[^ ]*\) .*/\1/p' | sort
}

# The TV may be on either HDMI port: the screen goes on the one with a display, HDMI-A-1 if both have one. Without a
# TV, it waits on HDMI-A-1. Prints the output, and its EDID, so that a TV that is changed on the same port counts too.
chooseScreenOutput() {
  local output outputs
  outputs="$(hdmiOutputs)"
  for output in ${outputs}; do
    if hasDisplay "${output}"; then
      echo "${output} $(cat /sys/class/drm/card*-"${output}"/edid 2>/dev/null | md5sum | cut -c1-8)"
      return
    fi
  done
  head -n 1 <<< "${outputs}"
}

# The mode of an output that comes closest to the one asked for, as sway wants it, e.g. "1920x1080@59.940Hz"; with no
# mode asked for, or one the output doesn't offer, its preferred mode, the first one sway lists. sway would take any mode
# without complaint, and a TV that can't show it drops the input: the screen would stay black.
# output::string
# mode::string: e.g. "1920x1080@60Hz" or "1920x1080", or empty
# -> prints the mode, "preferred " before it when it is the fallback, and nothing if sway lists none for the output
chooseMode() {
  swaymsg -t get_outputs -p | awk -v output="$1" -v wanted="$2" '
    BEGIN {
      split(wanted, parts, "@")
      size = parts[1]
      rate = parts[2]
      sub(/Hz$/, "", rate)
    }
    /^Output / { inside = ($2 == output); listing = 0; next }
    inside && /Available modes:/ { listing = 1; next }
    # e.g. "    1920x1080 @ 60.000 Hz"
    inside && listing && $2 == "@" {
      mode = $1 "@" $3 "Hz"
      if (preferred == "") preferred = mode
      # without a rate, the one closest to 60 Hz: TVs list faster ones (e.g. 120 Hz) first, which cost the Pi twice
      if ($1 == size) {
        # "+ 0": as numbers, not strings
        target = (rate == "") ? 60 : rate + 0
        refresh = $3 + 0
        distance = refresh > target ? refresh - target : target - refresh
        if ((rate == "" || distance < 0.5) && (best == "" || distance < bestDistance)) { best = mode; bestDistance = distance }
      }
    }
    END {
      if (best != "") print best
      else if (preferred != "") print "preferred " preferred
    }'
}

# Puts the screen's workspace on an HDMI output at SCREEN_MODE and switches the other HDMI outputs off, so the GPU
# doesn't draw a picture that nobody sees.
# output::string
placeScreen() {
  local target="$1" output mode
  mode="$(chooseMode "${target}" "${SCREEN_MODE}")"
  if [[ "${mode}" == "preferred "* ]]; then
    mode="${mode#preferred }"
    if [ -n "${SCREEN_MODE}" ]; then
      log "${target} doesn't offer SCREEN_MODE ${SCREEN_MODE}, using its preferred mode ${mode}"
    fi
  fi
  # the mode always, also the preferred one: sway would keep one set before on this output
  if [ -z "${mode}" ] || ! swaymsg "output ${target} enable mode ${mode}" > /dev/null; then
    swaymsg "output ${target} enable" > /dev/null
  fi
  # where the workspace is created, and where sway puts it back when the output is switched on again
  swaymsg "workspace screen output ${target}" > /dev/null
  if swaymsg -t get_workspaces -p | grep -q '^Workspace screen'; then
    swaymsg "workspace screen; move workspace to output ${target}" > /dev/null
    if [ -n "${TOUCH_OUTPUT}" ]; then
      # the touch display keeps the focus, for its on-screen keyboard
      swaymsg "workspace master" > /dev/null
    fi
  fi
  for output in $(hdmiOutputs); do
    if [ "${output}" != "${target}" ]; then
      swaymsg "output ${output} disable" > /dev/null
    fi
  done
  log "The screen is on ${target} ($(hasDisplay "${target}" && echo "with a display" || echo "waiting for a TV"))"
}

# Follows the TV to the other port, to a port it is plugged into later, and to another TV on the same port. The ports
# are read every two seconds: sway doesn't tell when a TV is plugged into HDMI-A-1, which is always there.
# choice::string: what chooseScreenOutput printed for the current output
followScreenOutput() {
  local current="$1" choice
  while isSwayRunning; do
    sleep 2
    choice="$(chooseScreenOutput)"
    if [ -n "${choice}" ] && [ "${choice}" != "${current}" ]; then
      placeScreen "${choice%% *}"
      current="${choice}"
    fi
  done
}

# e.g. "HDMI-A-1", "HDMI-A-2" and "DSI-1"
OUTPUTS="$(swaymsg -t get_outputs -p | sed -n 's/^Output \([^ ]*\) .*/\1/p')"
TOUCH_OUTPUT="$(grep -m 1 '^DSI-' <<< "${OUTPUTS}")"
SCREEN_CHOICE="$(chooseScreenOutput)"
SCREEN_OUTPUT="${SCREEN_CHOICE%% *}"
if [ -z "${SCREEN_OUTPUT}" ]; then
  SCREEN_OUTPUT="$(grep -m 1 -v '^DSI-' <<< "${OUTPUTS}")"
fi
log "Outputs: ${OUTPUTS//$'\n'/ }; the screen goes on ${SCREEN_OUTPUT:-none}, the master on ${TOUCH_OUTPUT:-none}"

# Runs a browser on an output, again and again. It gets a workspace of its own on that output, and sway puts its window
# there by its process ID.
# name::string: names the workspace and the cache
# output::string: empty for the screen, whose workspace placeScreen puts on an output
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
    if [ -n "${output}" ]; then
      swaymsg "workspace ${name} output ${output}" > /dev/null
    fi
    swaymsg "workspace ${name}" > /dev/null
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
    sleep 2
    if ! isSwayRunning; then
      log "The browser of the ${name} exited, and sway is gone: not starting it again"
      return 0
    fi
    log "The browser of the ${name} exited, starting it again"
  done
}

if [ -n "${SCREEN_OUTPUT}" ]; then
  if [[ "${SCREEN_OUTPUT}" == HDMI-* ]]; then
    placeScreen "${SCREEN_OUTPUT}"
    followScreenOutput "${SCREEN_CHOICE}" &
  else
    swaymsg "workspace screen output ${SCREEN_OUTPUT}" > /dev/null
  fi
  # the default profile, so that it keeps what the screen stored before there was a master on the box
  runBrowser screen "" --kiosk --autoplay-policy=no-user-gesture-required http://localhost/screen/ &
fi

if [ -n "${TOUCH_OUTPUT}" ]; then
  # The display is portrait by itself. Raspberry Pi's wlroots turns the touch input along with the output, so it only
  # needs to be tied to the display (measured on the 10" display: a calibration matrix on top turned it twice).
  TRANSFORM="${TOUCH_DISPLAY_ROTATION}"
  if [[ ! "${TRANSFORM}" =~ ^(90|180|270)$ ]]; then
    TRANSFORM=normal
  fi
  swaymsg "output ${TOUCH_OUTPUT} transform ${TRANSFORM}" > /dev/null
  swaymsg "input type:touch map_to_output ${TOUCH_OUTPUT}" > /dev/null

  # It shows itself when a text field gets the focus, see roles/kiosk/tasks/main.yml. It takes the bottom of the
  # display, and the master's window gets smaller, so that the field stays visible.
  while true; do
    squeekboard
    sleep 2
    if ! isSwayRunning; then
      log "The on-screen keyboard exited, and sway is gone: not starting it again"
      break
    fi
    log "The on-screen keyboard exited, starting it again"
  done &

  # Under the hostname, not localhost: the master stores media as full URLs on the host it was opened under, which
  # other devices load too. Its sound would play twice, since the screen plays it as well. The browser is an app window
  # rather than in kiosk mode: a fullscreen window would hide the on-screen keyboard. Chromium draws it at the scale
  # itself (buzzerbox-apply-settings chose it): sharp at any factor, where an output scale of sway would make Chromium
  # draw at twice the size and sway shrink it, which is blurry and costs the GPU.
  runBrowser master "${TOUCH_OUTPUT}" \
    --user-data-dir="${HOME}/.config/buzzerbox-master" \
    --force-device-scale-factor="${TOUCH_DISPLAY_SCALE}" \
    --mute-audio --disable-pinch --overscroll-history-navigation=0 \
    --enable-wayland-ime --wayland-text-input-version=3 \
    --app="${MASTER_URL}" &
fi

# The loops above only end if something killed them. Then the session starts again as a whole (sway.conf), rather than
# going on without that browser.
wait -n
log "A browser or the on-screen keyboard is no longer started again, ending the session"
