#!/bin/bash
# Takes the public SSH keys from buzzerbox-ssh-keys.txt on the boot partition, so that SSH can be turned on for a box
# by copying a key onto its SD card or eMMC from any computer. buzzerbox-ssh-keys.service runs it on every boot, before
# ssh.service, which only starts while there are keys (see roles/ssh). Without a file, or without a valid key in it,
# the keys from the last boot are removed again, so taking the key off the card turns SSH off at the next start.

set -euo pipefail

KEYS_FILE="/boot/firmware/buzzerbox-ssh-keys.txt"
# sshd reads it in addition to the admin user's ~/.ssh/authorized_keys (AuthorizedKeysFile in roles/ssh)
AUTHORIZED_FILE="/etc/buzzerbox/ssh_authorized_keys"
# plain public keys only: options like command= or from= aren't meant for this file
KEY_PATTERN='^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) '

log() {
  echo "buzzerbox-ssh-keys: $*" >&2
}

keys=""
count=0
if [ -f "${KEYS_FILE}" ]; then
  # nothing of a private key may end up in the journal, so only line numbers are logged
  if grep -q 'PRIVATE KEY' "${KEYS_FILE}"; then
    log "${KEYS_FILE} holds a private key, which never belongs there: remove it, and don't use that key anymore"
  fi
  checked="$(mktemp)"
  trap 'rm -f "${checked}"' EXIT
  number=0
  while IFS= read -r line || [ -n "${line}" ]; do
    number=$((number + 1))
    # Windows line endings and spaces around the key are fine
    line="${line//$'\r'/}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    if [ -z "${line}" ] || [[ "${line}" == \#* ]]; then
      continue
    fi
    if [[ ! "${line}" =~ ${KEY_PATTERN} ]]; then
      log "Ignoring line ${number}, which is no public SSH key"
      continue
    fi
    echo "${line}" > "${checked}"
    if ! fingerprint="$(ssh-keygen -l -f "${checked}" 2>/dev/null)"; then
      log "Ignoring line ${number}, an invalid ${line%% *} key"
      continue
    fi
    log "Allowing the key ${fingerprint}"
    keys+="${line}"$'\n'
    count=$((count + 1))
  done < "${KEYS_FILE}"
fi

if [ "${count}" -eq 0 ]; then
  if [ -e "${AUTHORIZED_FILE}" ]; then
    rm -f "${AUTHORIZED_FILE}"
    log "No keys on the boot partition anymore, removed the ones from before"
  fi
  exit 0
fi

# only written when the keys changed
if [ ! -f "${AUTHORIZED_FILE}" ] || [ "$(cat "${AUTHORIZED_FILE}")"$'\n' != "${keys}" ]; then
  mkdir -p "$(dirname "${AUTHORIZED_FILE}")"
  printf '%s' "${keys}" > "${AUTHORIZED_FILE}.tmp"
  chmod 0644 "${AUTHORIZED_FILE}.tmp"
  mv -f "${AUTHORIZED_FILE}.tmp" "${AUTHORIZED_FILE}"
  log "Took ${count} key(s) from ${KEYS_FILE}"
fi
