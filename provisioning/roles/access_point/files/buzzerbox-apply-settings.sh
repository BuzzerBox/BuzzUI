#!/bin/bash
# Applies the per-box settings from buzzerbox.txt on the boot partition: the WiFi access point of NetworkManager, the
# names the box answers to in it and the WiFi country. buzzerbox-settings.service runs it on every boot, before
# NetworkManager starts. Values that are missing or invalid fall back to the defaults in /etc/buzzerbox/settings.defaults,
# which the setup wrote (provisioning/group_vars/all.yml). Files are only written when something changed.

set -euo pipefail

DEFAULTS_FILE="/etc/buzzerbox/settings.defaults"
SETTINGS_FILE="/boot/firmware/buzzerbox.txt"
CMDLINE_FILE="/boot/firmware/cmdline.txt"
CONNECTION_FILE="/etc/NetworkManager/system-connections/buzzerbox-ap.nmconnection"
DNSMASQ_FILE="/etc/NetworkManager/dnsmasq-shared.d/buzzerbox.conf"
# fixed, so that the connection file stays the same as long as the settings do
CONNECTION_UUID="6f1d6a52-8c3b-4a51-9a2e-1b8e0c5d2b77"
# the addresses devices get, in the /24 network of SERVER_IP_ADDRESS
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
    SERVER_IP_ADDRESS)
      [[ "${value}" =~ ^${octet}\.${octet}\.${octet}\.${octet}$ ]] || return 1
      local last="${value##*.}"
      [ "${last}" -ge 1 ] && [ "${last}" -le 254 ] && { [ "${last}" -lt "${DHCP_FIRST}" ] || [ "${last}" -gt "${DHCP_LAST}" ]; }
      ;;
    SERVER_HOSTNAMES) [[ "${value}" =~ ^[A-Za-z0-9.-]+([[:space:]]+[A-Za-z0-9.-]+)*$ ]] ;;
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

# NetworkManager's dnsmasq of the shared connection answers for the hostnames
read -r -a HOSTNAMES <<< "${settings[SERVER_HOSTNAMES]}"
for hostname in "${HOSTNAMES[@]}"; do
  echo "address=/${hostname}/${IP}"
done | writeIfChanged "${DNSMASQ_FILE}" 644 || true

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
