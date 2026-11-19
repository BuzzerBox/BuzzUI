#!/bin/bash
# Changes the per-box settings in buzzerbox.txt on the boot partition for the master, which the server can't write
# itself (see server/services/box-settings.service.ts). It is installed to /usr/local/sbin/buzzerbox-settings and runs
# as root, through sudo.
#
#   buzzerbox-settings write     reads KEY=value lines from stdin and writes them into buzzerbox.txt
#   buzzerbox-settings restart   restarts the box, which applies the settings (buzzerbox-apply-settings)
#   buzzerbox-settings write-ssh-keys
#                                reads public SSH keys from stdin, one per line, puts them into buzzerbox-ssh-keys.txt
#                                instead of the ones there and applies them right away (buzzerbox-apply-ssh-keys)
#
# Writing only works if buzzerbox.txt itself has EDIT_IN_MASTER=true, so whoever can write to the card decides whether
# the master may change the settings; that setting can't be changed here. The values are checked as
# buzzerbox-apply-settings does it (and shared/helper/box-settings.helper.ts), so change them together. The file keeps
# its comments and order: a value is changed where it is, and a key the file lacks is added at its end. The keys file
# keeps its comments, and the keys follow them; the same flag allows changing it, since a key gives root access.

set -euo pipefail

SETTINGS_FILE="${BUZZERBOX_SETTINGS_FILE:-/boot/firmware/buzzerbox.txt}"
EDIT_KEY="EDIT_IN_MASTER"
SSH_KEYS_FILE="${BUZZERBOX_SSH_KEYS_FILE:-/boot/firmware/buzzerbox-ssh-keys.txt}"
# the same as in buzzerbox-apply-ssh-keys: plain public keys only
SSH_KEY_PATTERN='^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,3}( [^[:cntrl:]]*)?$'
KEYS=(WIFI_SSID WIFI_PASSPHRASE WIFI_COUNTRY_CODE WIFI_CHANNEL WIFI_ANTENNA ANALOG_BUZZERS SERVER_IP_ADDRESS ETHERNET_IP_ADDRESS
  SERVER_HOSTNAMES SCREEN_MODE TOUCH_DISPLAY TOUCH_DISPLAY_ROTATION TOUCH_DISPLAY_SCALE)
DHCP_FIRST=50
DHCP_LAST=150

log() {
  echo "buzzerbox-settings: $*" >&2
}

trim() {
  local value="$1"
  value="${value//$'\r'/}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

# Prints the value of a key in the settings file, as buzzerbox-apply-settings reads it: the last line wins
# key::string
fileValue() {
  local key="$1" line lineKey value=""
  while IFS= read -r line || [ -n "${line}" ]; do
    if [[ "${line}" != *=* ]]; then
      continue
    fi
    lineKey="$(trim "${line%%=*}")"
    if [ "${lineKey}" = "${key}" ] && [ -n "$(trim "${line#*=}")" ]; then
      value="$(trim "${line#*=}")"
    fi
  done < "${SETTINGS_FILE}"
  printf '%s' "${value}"
}

# The same as isValid in buzzerbox-apply-settings
# key::string
# value::string
# -> 0 if the value is valid for the key
isValid() {
  local key="$1" value="$2" octet='(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])'
  # count bytes, not characters
  local LC_ALL=C
  # the value must survive being read back: no spaces around it, no control characters
  if [ -z "${value}" ] || [ "$(trim "${value}")" != "${value}" ] || [[ "${value}" == *[[:cntrl:]]* ]]; then
    return 1
  fi
  case "${key}" in
    WIFI_SSID) [ "${#value}" -ge 1 ] && [ "${#value}" -le 32 ] ;;
    WIFI_PASSPHRASE) [[ "${value}" =~ ^[[:print:]]{8,63}$ ]] ;;
    WIFI_COUNTRY_CODE) [[ "${value}" =~ ^[A-Za-z]{2}$ ]] ;;
    WIFI_CHANNEL) [[ "${value}" =~ ^([1-9]|1[0-3])$ ]] ;;
    WIFI_ANTENNA) [[ "${value,,}" =~ ^(internal|external)$ ]] ;;
    ANALOG_BUZZERS) [[ "${value,,}" =~ ^(yes|no)$ ]] ;;
    SERVER_IP_ADDRESS|ETHERNET_IP_ADDRESS)
      [[ "${value}" =~ ^${octet}\.${octet}\.${octet}\.${octet}$ ]] || return 1
      local last="${value##*.}"
      [ "${last}" -ge 1 ] && [ "${last}" -le 254 ] && { [ "${last}" -lt "${DHCP_FIRST}" ] || [ "${last}" -gt "${DHCP_LAST}" ]; }
      ;;
    SERVER_HOSTNAMES) [[ "${value}" =~ ^[A-Za-z0-9.-]+([[:space:]]+[A-Za-z0-9.-]+)*$ ]] ;;
    TOUCH_DISPLAY) [[ "${value,,}" =~ ^(none|5inch|7inch|10inch)$ ]] ;;
    TOUCH_DISPLAY_ROTATION) [[ "${value}" =~ ^(0|90|180|270)$ ]] ;;
    SCREEN_MODE) [[ "${value,,}" == auto ]] || [[ "${value}" =~ ^[1-9][0-9]{2,3}x[1-9][0-9]{2,3}(@[1-9][0-9]{1,2}(\.[0-9]{1,3})?)?$ ]] ;;
    TOUCH_DISPLAY_SCALE) [[ "${value,,}" == auto ]] || [[ "${value}" =~ ^(1(\.[0-9]{1,2})?|2(\.[0-9]{1,2})?|3(\.0{1,2})?)$ ]] ;;
    *) return 1 ;;
  esac
}

isKnownKey() {
  local key="$1" known
  for known in "${KEYS[@]}"; do
    if [ "${known}" = "${key}" ]; then
      return 0
    fi
  done
  return 1
}

checkEditable() {
  if [ ! -f "${SETTINGS_FILE}" ]; then
    log "${SETTINGS_FILE} is missing"
    return 1
  fi
  if [ "$(fileValue "${EDIT_KEY}" | tr '[:upper:]' '[:lower:]')" != "true" ]; then
    log "${SETTINGS_FILE} does not allow the master to change the settings (${EDIT_KEY}=true)"
    return 1
  fi
}

writeSshKeys() {
  checkEditable
  if [ ! -f "${SSH_KEYS_FILE}" ]; then
    log "${SSH_KEYS_FILE} is missing"
    return 1
  fi
  local line checked number=0
  local -a keys=()
  checked="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${checked}'" RETURN
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    number=$((number + 1))
    if [ -z "${line}" ]; then
      continue
    fi
    if [[ "${line}" == *"PRIVATE KEY"* ]] || [[ ! "${line}" =~ ${SSH_KEY_PATTERN} ]]; then
      log "Line ${number} is no public SSH key"
      return 1
    fi
    echo "${line}" > "${checked}"
    if ! ssh-keygen -l -f "${checked}" > /dev/null 2>&1; then
      log "Line ${number} is an invalid ${line%% *} key"
      return 1
    fi
    keys+=("${line}")
  done

  # the comments stay (the file explains itself), then the keys
  local content
  content="$(grep -E '^[[:space:]]*(#|$)' "${SSH_KEYS_FILE}" | tr -d '\r' || true)"
  content="$(printf '%s' "${content}" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')"
  if [ "${#keys[@]}" -gt 0 ]; then
    content+="${content:+$'\n\n'}$(printf '%s\n' "${keys[@]}")"
  fi
  printf '%s\n' "${content}" > "${SSH_KEYS_FILE}.tmp"
  mv -f "${SSH_KEYS_FILE}.tmp" "${SSH_KEYS_FILE}"
  sync
  log "Wrote ${#keys[@]} SSH key(s) to ${SSH_KEYS_FILE}"

  # right away instead of at the next start; ssh.service only runs while there are keys, and restarting it keeps the
  # sessions that are open
  if [ -x /usr/local/sbin/buzzerbox-apply-ssh-keys ]; then
    /usr/local/sbin/buzzerbox-apply-ssh-keys
    systemctl daemon-reload || true
    systemctl restart ssh.service || log "Could not restart ssh.service"
  fi
}

write() {
  checkEditable

  local line key value
  local -a keys=() values=()
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    if [ -z "${line}" ]; then
      continue
    fi
    if [[ "${line}" != *=* ]]; then
      log "Expected KEY=value"
      return 1
    fi
    key="${line%%=*}"
    value="${line#*=}"
    if ! isKnownKey "${key}"; then
      log "${key} can't be changed"
      return 1
    fi
    if ! isValid "${key}" "${value}"; then
      log "The value of ${key} is invalid"
      return 1
    fi
    keys+=("${key}")
    values+=("${value}")
  done
  if [ "${#keys[@]}" -eq 0 ]; then
    return 0
  fi

  # Each key's lines get the new value, since the last one would win; the values go through the environment, so that
  # awk doesn't interpret them
  local content index
  content="$(cat "${SETTINGS_FILE}")"
  for index in "${!keys[@]}"; do
    content="$(KEY="${keys[${index}]}" VALUE="${values[${index}]}" awk '
      function trim(s) { gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
      {
        eq = index($0, "=")
        if (eq > 0 && trim(substr($0, 1, eq - 1)) == ENVIRON["KEY"]) {
          cr = ($0 ~ /\r$/) ? "\r" : ""
          print ENVIRON["KEY"] "=" ENVIRON["VALUE"] cr
          found = 1
        } else {
          print
        }
      }
      END { if (!found) print ENVIRON["KEY"] "=" ENVIRON["VALUE"] }
    ' <<< "${content}")"
  done

  # FAT has no file modes; renaming in the same folder doesn't leave half a file behind
  printf '%s\n' "${content}" > "${SETTINGS_FILE}.tmp"
  mv -f "${SETTINGS_FILE}.tmp" "${SETTINGS_FILE}"
  sync
  log "Changed ${keys[*]} in ${SETTINGS_FILE}, which counts from the next start"
}

case "${1:-}" in
  write) write ;;
  write-ssh-keys) writeSshKeys ;;
  restart)
    log "Restarting the box for its settings"
    systemctl --no-block reboot
    ;;
  *)
    echo "Usage: $0 write|restart|write-ssh-keys" >&2
    exit 2
    ;;
esac
