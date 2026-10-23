#!/bin/bash
# Applies the per-box settings from buzzerbox.txt on the boot partition: the WiFi access point of NetworkManager, its
# counterpart on Ethernet (for a notebook on a cable, without a router), the names the box answers to in both, the WiFi
# country, the WiFi antenna, the WiFi the wireless buzzers are given and the touch display.
# buzzerbox-settings.service runs it on every boot, before NetworkManager starts, with --boot: only then does it restart
# the box for a changed antenna. Values that are missing or invalid fall back to the defaults in
# /etc/buzzerbox/settings.defaults, which the setup wrote (provisioning/group_vars/all.yml). Files are only written when
# something changed.

set -euo pipefail

BOOT=false
if [ "${1:-}" = "--boot" ]; then
  BOOT=true
fi

DEFAULTS_FILE="/etc/buzzerbox/settings.defaults"
SETTINGS_FILE="/boot/firmware/buzzerbox.txt"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
CONFIG_FILE="/boot/firmware/config.txt"
CONNECTION_FILE="/etc/NetworkManager/system-connections/buzzerbox-ap.nmconnection"
ETHERNET_CONNECTION_FILE="/etc/NetworkManager/system-connections/buzzerbox-ethernet.nmconnection"
DNSMASQ_FILE="/etc/NetworkManager/dnsmasq-shared.d/buzzerbox.conf"
# not in dnsmasq-shared.d, where every file is read as configuration
HOSTS_FILE="/etc/buzzerbox/hosts"
WIRELESS_BUZZERS_FILE="/etc/buzzerbox/wireless-buzzers.conf"
KIOSK_FILE="/etc/buzzerbox/kiosk.conf"
# fixed, so that the connection files stay the same as long as the settings do
CONNECTION_UUID="6f1d6a52-8c3b-4a51-9a2e-1b8e0c5d2b77"
ETHERNET_CONNECTION_UUID="0b6c3f0e-5d7a-4e21-8f4b-3c9a2d1e7f58"
# the addresses devices get, in the /24 network of SERVER_IP_ADDRESS and of ETHERNET_IP_ADDRESS
DHCP_FIRST=50
DHCP_LAST=150

log() {
  echo "buzzerbox-settings: $*" >&2
}

declare -A settings

# Reads KEY=value lines into settings. Comments, empty values and Windows line endings are fine. When validating, only
# keys that the defaults have are taken.
# file::string
# ?validate::boolean::false: whether to check the values (the defaults are trusted)
readSettings() {
  local file="$1" validate="${2:-false}" line key value
  while IFS= read -r line || [ -n "${line}" ]; do
    # split on the first "=" only: IFS='=' read would drop a trailing "=" of the value (e.g. of a passphrase)
    if [[ "${line}" != *=* ]]; then
      continue
    fi
    key="${line%%=*}"
    value="${line#*=}"
    key="${key//$'\r'/}"
    value="${value//$'\r'/}"
    # trim spaces around the key and the value
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [ -z "${key}" ] || [[ "${key}" == \#* ]] || [ -z "${value}" ]; then
      continue
    fi
    if [ "${validate}" = "true" ] && [ -z "${settings[${key}]+set}" ]; then
      log "Ignoring the unknown setting ${key} in ${file}"
      continue
    fi
    if [ "${validate}" = "true" ] && ! isValid "${key}" "${value}"; then
      log "Ignoring the invalid value of ${key} in ${file}, using the default"
      continue
    fi
    settings["${key}"]="${value}"
  done < "${file}"
}

# key::string
# value::string
# -> 0 if the value is valid for the key
isValid() {
  local key="$1" value="$2" octet='(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])'
  # count bytes, not characters
  local LC_ALL=C
  case "${key}" in
    WIFI_SSID) [ "${#value}" -ge 1 ] && [ "${#value}" -le 32 ] ;;
    WIFI_PASSPHRASE) [[ "${value}" =~ ^[[:print:]]{8,63}$ ]] ;;
    WIFI_COUNTRY_CODE) [[ "${value}" =~ ^[A-Za-z]{2}$ ]] ;;
    WIFI_CHANNEL) [[ "${value}" =~ ^([1-9]|1[0-3])$ ]] ;;
    WIFI_ANTENNA) [[ "${value,,}" =~ ^(internal|external)$ ]] ;;
    SERVER_IP_ADDRESS|ETHERNET_IP_ADDRESS)
      [[ "${value}" =~ ^${octet}\.${octet}\.${octet}\.${octet}$ ]] || return 1
      local last="${value##*.}"
      [ "${last}" -ge 1 ] && [ "${last}" -le 254 ] && { [ "${last}" -lt "${DHCP_FIRST}" ] || [ "${last}" -gt "${DHCP_LAST}" ]; }
      ;;
    SERVER_HOSTNAMES) [[ "${value}" =~ ^[A-Za-z0-9.-]+([[:space:]]+[A-Za-z0-9.-]+)*$ ]] ;;
    TOUCH_DISPLAY) [[ "${value,,}" =~ ^(none|5inch|7inch|10inch)$ ]] ;;
    TOUCH_DISPLAY_ROTATION) [[ "${value}" =~ ^(0|90|180|270)$ ]] ;;
    *) return 1 ;;
  esac
}

# Writes stdin to a file if that changes it.
# file::string
# mode::string
# -> 0 if the file was written
writeIfChanged() {
  local file="$1" mode="$2" content
  content="$(cat)"
  if [ -f "${file}" ] && [ "$(cat "${file}")" = "${content}" ]; then
    return 1
  fi
  mkdir -p "$(dirname "${file}")"
  printf '%s\n' "${content}" > "${file}.tmp"
  chmod "${mode}" "${file}.tmp"
  mv -f "${file}.tmp" "${file}"
  log "Wrote ${file}"
}

readSettings "${DEFAULTS_FILE}"
if [ -f "${SETTINGS_FILE}" ]; then
  readSettings "${SETTINGS_FILE}" true
else
  # so that there is a file to edit
  log "${SETTINGS_FILE} is missing, writing the defaults to it"
  cp "${DEFAULTS_FILE}" "${SETTINGS_FILE}"
fi
COUNTRY="${settings[WIFI_COUNTRY_CODE]^^}"
# Channels 12 and 13 are allowed in most countries, but not in these: the access point would not come up at all
CHANNEL="${settings[WIFI_CHANNEL]}"
case "${COUNTRY}" in
  US|CA|TW)
    if [ "${CHANNEL}" -gt 11 ]; then
      log "WiFi channel ${CHANNEL} is not allowed in ${COUNTRY}, using channel 11"
      CHANNEL=11
    fi
    ;;
esac
IP="${settings[SERVER_IP_ADDRESS]}"
SUBNET_PREFIX="${IP%.*}"

# nmcli writes the connection file itself (--offline), which takes care of escaping the SSID and the passphrase
CONNECTION="$(nmcli --offline connection add \
  connection.id BuzzerBox connection.uuid "${CONNECTION_UUID}" connection.autoconnect yes \
  type wifi ifname wlan0 \
  802-11-wireless.mode ap 802-11-wireless.ssid "${settings[WIFI_SSID]}" \
  802-11-wireless.band bg 802-11-wireless.channel "${CHANNEL}" \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${settings[WIFI_PASSPHRASE]}" \
  wifi-sec.proto rsn wifi-sec.pairwise ccmp wifi-sec.group ccmp wifi-sec.pmf disable \
  ipv4.method shared ipv4.addresses "${IP}/24" \
  ipv4.shared-dhcp-range "${SUBNET_PREFIX}.${DHCP_FIRST},${SUBNET_PREFIX}.${DHCP_LAST}" \
  ipv6.method disabled)"
writeIfChanged "${CONNECTION_FILE}" 600 <<< "${CONNECTION}" || true

# The same for a notebook on a cable: any wired interface (the built-in port, or a USB adapter, whose name differs from
# box to box) hands out addresses in its own /24 network. Both networks can't share one.
ETHERNET_IP="${settings[ETHERNET_IP_ADDRESS]}"
if [ "${ETHERNET_IP%.*}" = "${SUBNET_PREFIX}" ]; then
  log "ETHERNET_IP_ADDRESS ${ETHERNET_IP} is in the WiFi's network ${SUBNET_PREFIX}.0/24, using the default"
  ETHERNET_IP="$(grep -E '^ETHERNET_IP_ADDRESS=' "${DEFAULTS_FILE}" | cut -d= -f2)"
fi
ETHERNET_PREFIX="${ETHERNET_IP%.*}"
if [ "${ETHERNET_PREFIX}" = "${SUBNET_PREFIX}" ]; then
  log "The default ETHERNET_IP_ADDRESS ${ETHERNET_IP} is in the WiFi's network too, leaving Ethernet off"
  ETHERNET_IP=""
  if [ -f "${ETHERNET_CONNECTION_FILE}" ]; then
    rm -f "${ETHERNET_CONNECTION_FILE}"
    log "Removed ${ETHERNET_CONNECTION_FILE}"
  fi
else
  ETHERNET_CONNECTION="$(nmcli --offline connection add \
    connection.id "BuzzerBox Ethernet" connection.uuid "${ETHERNET_CONNECTION_UUID}" connection.autoconnect yes \
    type ethernet \
    ipv4.method shared ipv4.addresses "${ETHERNET_IP}/24" \
    ipv4.shared-dhcp-range "${ETHERNET_PREFIX}.${DHCP_FIRST},${ETHERNET_PREFIX}.${DHCP_LAST}" \
    ipv6.method disabled)"
  writeIfChanged "${ETHERNET_CONNECTION_FILE}" 600 <<< "${ETHERNET_CONNECTION}" || true
fi

# NetworkManager runs a dnsmasq for each shared connection, and all of them read dnsmasq-shared.d. So the hostnames
# have both addresses, and localise-queries answers each network with the address in it.
read -r -a HOSTNAMES <<< "${settings[SERVER_HOSTNAMES]}"
{
  echo "${IP}	${HOSTNAMES[*]}"
  if [ -n "${ETHERNET_IP}" ]; then
    echo "${ETHERNET_IP}	${HOSTNAMES[*]}"
  fi
} | writeIfChanged "${HOSTS_FILE}" 644 || true
printf 'addn-hosts=%s\nlocalise-queries\n' "${HOSTS_FILE}" | writeIfChanged "${DNSMASQ_FILE}" 644 || true

# The game server gives the wireless buzzers the WiFi when they are plugged into the box over USB
# (BuzzerProvisioningService). It runs as a member of dialout, for the serial ports, which may read the passphrase.
printf 'WIFI_SSID=%s\nWIFI_PASSPHRASE=%s\nSERVER_IP_ADDRESS=%s\n' "${settings[WIFI_SSID]}" "${settings[WIFI_PASSPHRASE]}" "${IP}" \
  | writeIfChanged "${WIRELESS_BUZZERS_FILE}" 640 || true
chgrp dialout "${WIRELESS_BUZZERS_FILE}"

# The box itself needs the hostnames too: the master stores media as full URLs on the host it was opened under (e.g.
# http://buzzer.box:4202/media/...), and the kiosk loads them. The box doesn't ask that dnsmasq, so they go into
# /etc/hosts, on the loopback address so that they work while the WiFi is down.
HOSTS_MARKER="# buzzerbox-settings"
{
  grep -v -F "${HOSTS_MARKER}" /etc/hosts
  echo "127.0.0.1	${HOSTNAMES[*]}	${HOSTS_MARKER}"
} | writeIfChanged /etc/hosts 644 || true

# The WiFi country: for this boot through iw, and for the next ones (before NetworkManager) on the kernel command line,
# as raspi-config does it
iw reg set "${COUNTRY}" || log "Could not set the WiFi country to ${COUNTRY}"
CMDLINE="$(cat "${CMDLINE_FILE}")"
# changed where it is, so that the order the playbook (roles/base) writes stays the same
if [[ " ${CMDLINE} " == *" cfg80211.ieee80211_regdom="* ]]; then
  NEW_CMDLINE="$(echo "${CMDLINE}" | sed -E "s/(^| )cfg80211\.ieee80211_regdom=[^ ]*/\1cfg80211.ieee80211_regdom=${COUNTRY}/g")"
else
  NEW_CMDLINE="${CMDLINE} cfg80211.ieee80211_regdom=${COUNTRY}"
fi
if [ "${NEW_CMDLINE}" != "${CMDLINE}" ]; then
  # FAT has no file modes
  echo "${NEW_CMDLINE}" > "${CMDLINE_FILE}.tmp"
  mv -f "${CMDLINE_FILE}.tmp" "${CMDLINE_FILE}"
  log "Set the WiFi country ${COUNTRY} on the kernel command line"
fi
# Raspberry Pi OS keeps WiFi blocked until a country is set. Unblocking it for this boot is not enough: systemd-rfkill
# restores the saved state when the WiFi chip shows up, and NetworkManager keeps its own switch, which it turns off
# while WiFi is blocked. So the saved states are cleared as well, as raspi-config does it.
rfkill unblock wifi || true
for state in /var/lib/systemd/rfkill/*:wlan; do
  if [ -f "${state}" ]; then
    echo 0 > "${state}"
  fi
done
NM_STATE=/var/lib/NetworkManager/NetworkManager.state
if [ -f "${NM_STATE}" ]; then
  sed -i 's/^WirelessEnabled=.*/WirelessEnabled=true/' "${NM_STATE}"
fi

# The kiosk (roles/kiosk) opens the master on the touch display under the first hostname, for the reason above, and
# turns the display the way it is mounted
printf 'MASTER_URL=http://%s/master/\nTOUCH_DISPLAY_ROTATION=%s\n' "${HOSTNAMES[0]}" "${settings[TOUCH_DISPLAY_ROTATION]}" \
  | writeIfChanged "${KIOSK_FILE}" 644 || true

# Puts a block of lines into config.txt between markers, where the block was before (so that the file stays the same
# when the lines do), or removes the block if there are no lines.
# name::string: names the markers
# lines::string
# -> 0 if config.txt changed, 1 if it already had the lines, 2 if it could not be written
setConfigBlock() {
  local name="$1" lines="$2" config new
  config="$(cat "${CONFIG_FILE}")"
  new="$(BEGIN="# BEGIN BuzzerBox ${name} (buzzerbox-settings)" END="# END BuzzerBox ${name} (buzzerbox-settings)" \
    LINES="${lines}" awk '
      function block() { if (ENVIRON["LINES"] != "") { print ENVIRON["BEGIN"]; print ENVIRON["LINES"]; print ENVIRON["END"] } }
      $0 == ENVIRON["BEGIN"] { skip = 1; if (!done) block(); done = 1 }
      !skip { print }
      $0 == ENVIRON["END"] { skip = 0 }
      END { if (!done) block() }' <<< "${config}")"
  if [ "${new}" = "${config}" ]; then
    return 1
  fi
  # FAT has no file modes
  printf '%s\n' "${new}" > "${CONFIG_FILE}.tmp"
  mv -f "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
  sync
  # only if the file really says so now, or the box would restart over and over
  if [ "$(cat "${CONFIG_FILE}")" != "${new}" ]; then
    log "Could not write ${CONFIG_FILE}"
    return 2
  fi
}

# The firmware reads config.txt before Linux starts, so changes there only count after a restart. This is last, so that
# the other settings are written before.
RESTART_FOR=()
MODEL="$(tr -d '\0' < /proc/device-tree/model 2>/dev/null || true)"

# The antenna of a CM4 is chosen in config.txt: dtparam=ant2 is the external one, and without it the internal one is
# used. So only the external antenna gets a block, under [cm4], which a Raspberry Pi 4 (no connector) skips.
ANTENNA="${settings[WIFI_ANTENNA],,}"
ANTENNA_LINES=""
if [ "${ANTENNA}" = "external" ]; then
  ANTENNA_LINES=$'[cm4]\ndtparam=ant2\n[all]'
fi
if setConfigBlock antenna "${ANTENNA_LINES}"; then
  log "Set the ${ANTENNA} WiFi antenna in ${CONFIG_FILE}"
  if [[ "${MODEL}" != *"Compute Module 4"* ]]; then
    log "This box (${MODEL:-unknown model}) has no antenna connector, WIFI_ANTENNA only counts on a Compute Module 4"
  else
    RESTART_FOR+=("the new antenna")
  fi
fi

# A Compute Module doesn't detect DSI displays, so the Touch Display 2 is named in config.txt. It goes on DISP1 (the
# 10" one needs its four lanes). The overlay leaves it portrait: the kiosk turns it.
case "${settings[TOUCH_DISPLAY],,}" in
  5inch) TOUCH_OVERLAY="vc4-kms-dsi-ili9881-5inch" ;;
  7inch) TOUCH_OVERLAY="vc4-kms-dsi-ili9881-7inch" ;;
  10inch) TOUCH_OVERLAY="vc4-kms-dsi-ili79600-10-1inch" ;;
  *) TOUCH_OVERLAY="" ;;
esac
if setConfigBlock "touch display" "${TOUCH_OVERLAY:+$'[all]\n'dtoverlay=${TOUCH_OVERLAY}}"; then
  log "Set the touch display ${settings[TOUCH_DISPLAY],,} in ${CONFIG_FILE}"
  RESTART_FOR+=("the touch display")
fi

if [ "${#RESTART_FOR[@]}" -gt 0 ]; then
  if [ "${BOOT}" != "true" ]; then
    log "${RESTART_FOR[*]} only count after the next restart"
  else
    log "Restarting the box for ${RESTART_FOR[*]}"
    systemctl --no-block reboot
  fi
fi
