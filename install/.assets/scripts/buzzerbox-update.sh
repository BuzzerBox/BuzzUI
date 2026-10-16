#!/bin/bash
# Installs a signed BuzzerBox update bundle (see scripts/create-update-bundle.sh) and rolls back if the new version does
# not start. It is installed to /usr/local/sbin/buzzerbox-update and runs as root.
#
#   buzzerbox-update start [--allow-unsigned] <bundle>    install in the background; what the server calls (through
#                                                       sudo) for the master
#   buzzerbox-update install [--allow-unsigned] <bundle>  install and wait for the result, e.g. over SSH
#   buzzerbox-update rollback          go back to the previously installed version
#   buzzerbox-update status            print the status of the last update
#   buzzerbox-update recover           mark an update that was interrupted (e.g. by a power cut) as failed
#
# --allow-unsigned installs a bundle without a valid signature, unless /etc/buzzerbox/require-signed-updates exists.
# Releases live in __INSTALL_DIR__/releases/<version>, and __INSTALL_DIR__/current links to the one that runs. nginx
# serves current/frontend and the buzzerbox-server service runs current/backend.

set -euo pipefail

INSTALL_DIR="${BUZZERBOX_INSTALL_DIR:-__INSTALL_DIR__}"
RELEASES_DIR="${INSTALL_DIR}/releases"
CURRENT_LINK="${INSTALL_DIR}/current"
PUBLIC_KEY="${BUZZERBOX_UPDATE_PUBLIC_KEY:-/etc/buzzerbox/update-public-key.pem}"
# when this file exists, --allow-unsigned is ignored
REQUIRE_SIGNED_FILE="/etc/buzzerbox/require-signed-updates"
ALLOW_UNSIGNED=""
# what install() is doing, for undoing it when it stops unexpectedly (see failIfStillRunning)
INSTALLING_VERSION=""
PREVIOUS_VERSION=""
IS_NEW_RELEASE_IN_PLACE=""
STATE_DIR="${BUZZERBOX_STATE_DIR:-/var/lib/buzzerbox}"
STATUS_FILE="${STATE_DIR}/update-status.json"
LOCK_FILE="/run/buzzerbox-update.lock"
SERVICE="buzzerbox-server.service"
# how long the new version gets to answer, and how many releases are kept on the card
HEALTH_CHECK_TIMEOUT_IN_S=60
RELEASES_TO_KEEP=3

log() {
  echo "buzzerbox-update: $*" >&2
}

# state::string: one of running, succeeded, failed, rolled-back (see shared/enums/EUpdateStates.ts)
# version::string: the version that is being installed
# ?message::string: shown to the master
writeStatus() {
  mkdir -p "${STATE_DIR}"
  STATE="$1" VERSION="$2" MESSAGE="${3:-}" node -e '
    const status = {state: process.env.STATE, version: process.env.VERSION, time: new Date().toISOString()};
    if (process.env.MESSAGE) status.message = process.env.MESSAGE;
    process.stdout.write(JSON.stringify(status) + "\n");
  ' > "${STATUS_FILE}.tmp"
  chmod 644 "${STATUS_FILE}.tmp"
  mv -f "${STATUS_FILE}.tmp" "${STATUS_FILE}"
}

# prints the version of the release current links to, if any
currentVersion() {
  if [ -L "${CURRENT_LINK}" ]; then
    basename "$(readlink "${CURRENT_LINK}")"
  fi
}

# Points current to another release without a moment where it is missing
# version::string
switchTo() {
  ln -sfn "releases/$1" "${CURRENT_LINK}.new"
  mv -T "${CURRENT_LINK}.new" "${CURRENT_LINK}"
}

# Restarts the server and waits until it answers. The game server answers plain HTTP with 426 (Upgrade Required).
# -> 0 if the server answers
restartAndCheck() {
  local port
  port="$(node -e 'console.log(require(process.argv[1]).server.port)' "${CURRENT_LINK}/backend/config.json")"
  # the server must not hold on to the lock of this update
  systemctl restart "${SERVICE}" 9>&-
  local waited=0
  while [ "${waited}" -lt "${HEALTH_CHECK_TIMEOUT_IN_S}" ]; do
    sleep 2
    waited=$((waited + 2))
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}/" || true)" = "426" ]; then
      return 0
    fi
  done
  return 1
}

# Checks the signature and the checksum of a bundle and unpacks it.
# Bundles without a valid signature are only unpacked with --allow-unsigned.
# bundle::string: path to the bundle
# target::string: empty directory to unpack the release into
# -> prints the version of the bundle, followed by " unsigned" if it has no valid signature
unpackBundle() {
  local bundle="$1" target="$2" work="$2/.bundle" signatureProblem=""
  mkdir -p "${work}"
  tar --no-same-owner -xf "${bundle}" -C "${work}" manifest.json payload.tar.gz \
    || { log "${bundle} is not an update bundle"; return 1; }
  # unsigned bundles have none
  tar --no-same-owner -xf "${bundle}" -C "${work}" manifest.sig 2> /dev/null || true

  if [ ! -f "${work}/manifest.sig" ]; then
    signatureProblem="The bundle is not signed"
  elif [ ! -f "${PUBLIC_KEY}" ]; then
    signatureProblem="There is no public key at ${PUBLIC_KEY} to check updates with"
  # node rather than openssl, whose version on Raspbian Buster can't check Ed25519 signatures
  elif ! node -e '
    const crypto = require("crypto"), fs = require("fs");
    const [publicKey, manifest, signature] = process.argv.slice(1).map(file => fs.readFileSync(file));
    process.exit(crypto.verify(null, manifest, crypto.createPublicKey(publicKey), signature) ? 0 : 1);
  ' "${PUBLIC_KEY}" "${work}/manifest.json" "${work}/manifest.sig"; then
    signatureProblem="The signature of the bundle is not valid"
  fi
  if [ -n "${signatureProblem}" ]; then
    if [ -z "${ALLOW_UNSIGNED}" ]; then
      log "${signatureProblem}"
      return 1
    fi
    if [ -f "${REQUIRE_SIGNED_FILE}" ]; then
      log "${signatureProblem}, and this box only installs signed updates (${REQUIRE_SIGNED_FILE})"
      return 1
    fi
    log "WARNING: ${signatureProblem}. Installing it anyway, as requested with --allow-unsigned"
  fi

  local version sha256 fileNameVersion
  version="$(node -e 'console.log(require(process.argv[1]).version)' "${work}/manifest.json")"
  sha256="$(node -e 'console.log(require(process.argv[1]).payloadSha256)' "${work}/manifest.json")"
  # starting with a digit, so it can't be "." or "..", which would point releases/<version> elsewhere
  if ! [[ "${version}" =~ ^[0-9][0-9A-Za-z.+-]*$ ]]; then
    log "The bundle has an invalid version '${version}'"
    return 1
  fi
  fileNameVersion="$(basename "${bundle}" .tar)"
  fileNameVersion="${fileNameVersion#buzzerbox-update-}"
  if [ "${fileNameVersion}" != "${version}" ]; then
    log "The bundle is named for version ${fileNameVersion} but contains version ${version}"
    return 1
  fi
  if [ "$(sha256sum "${work}/payload.tar.gz" | cut -d' ' -f1)" != "${sha256}" ]; then
    log "The bundle is damaged (checksum mismatch)"
    return 1
  fi

  tar --no-same-owner -xzf "${work}/payload.tar.gz" -C "${target}" || { log "The bundle could not be unpacked"; return 1; }
  rm -rf "${work}"
  echo "${version}${signatureProblem:+ unsigned}"
}

# Removes all but the newest releases, but never the current and the previous one
# previous::string: the version that ran before the update
cleanUpReleases() {
  local current previous="$1"
  current="$(currentVersion)"
  local count=0
  for release in $(ls -1t "${RELEASES_DIR}"); do
    count=$((count + 1))
    if [ "${count}" -gt "${RELEASES_TO_KEEP}" ] && [ "${release}" != "${current}" ] && [ "${release}" != "${previous}" ]; then
      rm -rf "${RELEASES_DIR:?}/${release}"
    fi
  done
}

# Undoes installing a version: current goes back to the version that ran before, the release the new files replaced
# comes back, and new files that replaced nothing are removed, so that a later rollback can't go to them.
# version::string: the version that was being installed
# previous::string: the version that ran before
# isInPlace::string: whether the new files were already moved to releases/<version>
undoInstall() {
  local version="$1" previous="$2" isInPlace="$3" replaced="${RELEASES_DIR}/.replaced-$1"
  if [ -n "${previous}" ] && [ "${previous}" != "${version}" ] && [ -d "${RELEASES_DIR}/${previous}" ]; then
    switchTo "${previous}"
  fi
  if [ -d "${replaced}" ]; then
    rm -rf "${RELEASES_DIR:?}/${version}"
    mv -T "${replaced}" "${RELEASES_DIR}/${version}"
    if [ "$(currentVersion)" = "$(basename "${replaced}")" ]; then
      switchTo "${version}"
    fi
  elif [ -n "${isInPlace}" ] && [ "$(currentVersion)" != "${version}" ]; then
    rm -rf "${RELEASES_DIR:?}/${version}"
  fi
  systemctl reload nginx || true
}

# An update that was interrupted while reinstalling the running version leaves current on the copy of the release it
# replaces (see install), which comes back
restoreReplacedRelease() {
  local current
  current="$(currentVersion)"
  if [[ "${current}" == .replaced-* ]]; then
    undoInstall "${current#.replaced-}" "" ""
  fi
}

# Runs when install() exits. If the script stopped on an unexpected error (set -e), the status would otherwise stay
# running, the master would wait for an update that is gone, and current could point to files that were never checked.
failIfStillRunning() {
  set +e
  if grep -q '"state":"running"' "${STATUS_FILE}" 2> /dev/null; then
    if [ -n "${INSTALLING_VERSION}" ]; then
      undoInstall "${INSTALLING_VERSION}" "${PREVIOUS_VERSION}" "${IS_NEW_RELEASE_IN_PLACE}"
      systemctl restart "${SERVICE}" 9>&-
    fi
    writeStatus failed "${INSTALLING_VERSION}" "The update stopped unexpectedly, version $(currentVersion) is running. See: journalctl -t buzzerbox-update"
  fi
}

install() {
  local bundle="$1"
  exec 9> "${LOCK_FILE}"
  if ! flock -n 9; then
    log "Another update is running"
    return 1
  fi
  trap failIfStillRunning EXIT
  # the overlay file system of raspi-config keeps changes in memory only, so an update would be gone after a reboot
  if [ -z "${BUZZERBOX_ALLOW_OVERLAY_ROOT:-}" ] && awk '$2 == "/" && $3 == "overlay" {found = 1} END {exit !found}' /proc/mounts; then
    writeStatus failed "" "The root file system is read-only (overlay file system), so updates cannot be installed"
    log "The root file system is an overlay, disable it before updating"
    return 1
  fi

  local previous staging unpacked version unsigned errors
  previous="$(currentVersion)"
  PREVIOUS_VERSION="${previous}"
  writeStatus running "" "Checking the bundle"
  mkdir -p "${RELEASES_DIR}"
  staging="$(mktemp -d "${RELEASES_DIR}/.staging-XXXXXX")"
  errors="$(mktemp)"
  if ! unpacked="$(unpackBundle "${bundle}" "${staging}" 2> "${errors}")"; then
    cat "${errors}" >&2
    # the last thing unpackBundle logged is why it failed, which the master shows
    writeStatus failed "" "$(tail -n 1 "${errors}" | sed 's/^buzzerbox-update: //')"
    rm -rf "${staging}" "${errors}"
    return 1
  fi
  # the warning about a missing signature goes to the journal
  cat "${errors}" >&2
  rm -f "${errors}"
  read -r version unsigned <<< "${unpacked}"
  INSTALLING_VERSION="${version}"
  writeStatus running "${version}" "Installing"
  log "Installing version ${version}${unsigned:+ WITHOUT A VALID SIGNATURE} (installed: ${previous:-none})"

  # A release of the same version is kept until the new files run, e.g. when reinstalling the running version, so that
  # it comes back if they don't. The copy is made of hard links, which costs no space, and its name starts with a dot,
  # so it is not taken for a release. current points to it while the release is replaced, so it never points to
  # nothing or to files that were not checked.
  local replaced="${RELEASES_DIR}/.replaced-${version}"
  rm -rf "${replaced}" "${replaced}.copying"
  if [ -d "${RELEASES_DIR}/${version}" ]; then
    # only a complete copy gets the name, since undoInstall would replace the release with it
    cp -al "${RELEASES_DIR}/${version}" "${replaced}.copying"
    mv -T "${replaced}.copying" "${replaced}"
    if [ "${version}" = "${previous}" ]; then
      switchTo "$(basename "${replaced}")"
    fi
    rm -rf "${RELEASES_DIR:?}/${version}"
  fi
  chmod 755 "${staging}"
  mv -T "${staging}" "${RELEASES_DIR}/${version}"
  IS_NEW_RELEASE_IN_PLACE=1
  switchTo "${version}"

  if [ -x "${RELEASES_DIR}/${version}/hooks/post-install.sh" ]; then
    log "Running the post-install hook"
    INSTALL_DIR="${INSTALL_DIR}" PREVIOUS_VERSION="${previous}" "${RELEASES_DIR}/${version}/hooks/post-install.sh" \
      || log "The post-install hook failed"
  fi
  systemctl reload nginx || true

  if restartAndCheck; then
    rm -rf "${replaced}"
    writeStatus succeeded "${version}" "${unsigned:+Installed without a valid signature}"
    log "Version ${version} is running"
    cleanUpReleases "${previous}"
    return 0
  fi

  log "Version ${version} did not start"
  undoInstall "${version}" "${previous}" 1
  if [ -n "${previous}" ] && [ -d "${RELEASES_DIR}/${previous}" ]; then
    restartAndCheck || log "The previous version ${previous} does not start either"
    writeStatus rolled-back "${version}" "Version ${previous} runs again. See: journalctl -u ${SERVICE}"
  else
    writeStatus failed "${version}" "The new version did not start. See: journalctl -u ${SERVICE}"
  fi
  return 1
}

# Called before the server starts (see buzzerbox-server.service). An update that is still marked as running without
# holding the lock was interrupted.
recover() {
  exec 9> "${LOCK_FILE}"
  if ! flock -n 9; then
    return 0
  fi
  # the server starts after this, so a failure here must not stop it
  restoreReplacedRelease || log "Could not restore the release an interrupted update replaced"
  if grep -q '"state":"running"' "${STATUS_FILE}" 2>/dev/null; then
    writeStatus failed "" "The update was interrupted, version $(currentVersion) is running"
  fi
}

rollback() {
  local current previous
  current="$(currentVersion)"
  # the newest release other than the current one
  previous="$(ls -1t "${RELEASES_DIR}" | grep -vxF "${current}" | head -n 1 || true)"
  if [ -z "${previous}" ]; then
    log "There is no other release to go back to"
    return 1
  fi
  log "Going back from ${current} to ${previous}"
  switchTo "${previous}"
  systemctl reload nginx || true
  restartAndCheck
}

if [ "$(id -u)" -ne 0 ]; then
  log "This needs to be run as root"
  exit 1
fi

COMMAND="${1:-}"
shift || true
if [ "${1:-}" = "--allow-unsigned" ]; then
  ALLOW_UNSIGNED=1
  shift
fi

case "${COMMAND}" in
  start)
    [ -n "${1:-}" ] || { log "Usage: $0 start [--allow-unsigned] <bundle>"; exit 1; }
    bundle="$(realpath "$1")"
    # refused before writing the status, which belongs to the update that is running
    exec 9> "${LOCK_FILE}"
    if ! flock -n 9; then
      log "Another update is running"
      exit 1
    fi
    exec 9>&-
    writeStatus running "" "Starting"
    # the update restarts the server that calls this, so it has to run outside of the server's service.
    # The PID keeps the unit name unique when two updates are started within a second.
    if ! systemd-run --unit="buzzerbox-update-$(date +%s)-$$" --collect --quiet "$(realpath "$0")" install \
        ${ALLOW_UNSIGNED:+--allow-unsigned} "${bundle}"; then
      writeStatus failed "" "The update could not be started"
      exit 1
    fi
    ;;
  install)
    [ -n "${1:-}" ] || { log "Usage: $0 install [--allow-unsigned] <bundle>"; exit 1; }
    install "$(realpath "$1")"
    ;;
  rollback)
    rollback
    ;;
  recover)
    recover
    ;;
  status)
    cat "${STATUS_FILE}" 2>/dev/null || echo "No update was installed yet"
    ;;
  *)
    sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
