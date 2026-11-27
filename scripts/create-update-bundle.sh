#!/bin/bash
# Builds a signed update bundle updates/buzzerbox-update-<version>.tar that a BuzzerBox installs from a USB stick.
# The version comes from version.json, so raise it first.
#   ./create-update-bundle.sh <private-key.pem>
#   ./create-update-bundle.sh --unsigned
# The key can also be passed as BUZZERBOX_UPDATE_SIGNING_KEY. Create one with: node update-signing.js generate-key
# A box installs an unsigned bundle only after the master confirmed a warning.
# The signature is checked against install/.assets/update-public-key.pem, the key the boxes have, or against
# BUZZERBOX_UPDATE_PUBLIC_KEY if set, so a bundle that the boxes would refuse is not created.
#
# The bundle holds manifest.json (version and checksum of the payload), its signature manifest.sig and payload.tar.gz,
# which is unpacked into releases/<version> on the box: frontend/, backend/ (with node_modules) and hooks/.
#
# A build with other extensions (see docs/extensions.md) sets two variables:
#   BUZZERBOX_EXTRA_PAYLOAD   a folder whose files are added to the payload, e.g. nginx/<id>.conf (included by the
#                             box's nginx site) and hooks/post-install.d/<id>.sh (run after the post-install hook).
#                             They may add files, but not replace any of the core's.
#   BUZZERBOX_VERSION_SUFFIX  appended to the version, e.g. "+games.1.2", so that the bundle and the release on the box
#                             have names of their own. Versions are compared without what follows a "+".

set -euo pipefail

if [ "${1:-}" = "--unsigned" ]; then
  SIGNING_KEY=""
else
  SIGNING_KEY="${1:-${BUZZERBOX_UPDATE_SIGNING_KEY:-}}"
  if [ -z "${SIGNING_KEY}" ] || [ ! -f "${SIGNING_KEY}" ]; then
    echo "Usage: $0 <private-key.pem> | --unsigned"
    exit 1
  fi
  SIGNING_KEY="$(cd "$(dirname "${SIGNING_KEY}")" && pwd)/$(basename "${SIGNING_KEY}")"
fi

cd "$(dirname "$0")"
# the resolved path (pwd -P): npm ci doesn't take a folder reached through a link (e.g. macOS's /var) for its project
ROOT_DIR="$(cd .. && pwd -P)"
COMPILATIONS_DIR="${ROOT_DIR}/install/.assets/compilations"
OUTPUT_DIR="${ROOT_DIR}/updates"
VERSION="$(node -p "require('${ROOT_DIR}/version.json').version")${BUZZERBOX_VERSION_SUFFIX:-}"
# as the box's update helper checks it, since it installs to releases/<version>
if ! [[ "${VERSION}" =~ ^[0-9][0-9A-Za-z.+-]*$ ]]; then
  echo "Invalid version '${VERSION}': BUZZERBOX_VERSION_SUFFIX may only have letters, digits, '.', '+' and '-'"
  exit 1
fi
EXTRA_PAYLOAD="${BUZZERBOX_EXTRA_PAYLOAD:-}"
if [ -n "${EXTRA_PAYLOAD}" ] && [ ! -d "${EXTRA_PAYLOAD}" ]; then
  echo "BUZZERBOX_EXTRA_PAYLOAD is not a folder: ${EXTRA_PAYLOAD}"
  exit 1
fi
if [ -n "${EXTRA_PAYLOAD}" ]; then
  EXTRA_PAYLOAD="$(cd "${EXTRA_PAYLOAD}" && pwd)"
fi
PUBLIC_KEY="${BUZZERBOX_UPDATE_PUBLIC_KEY:-${ROOT_DIR}/install/.assets/update-public-key.pem}"

sh ./create-installation-files.sh

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT
mkdir -p "${WORK_DIR}/payload/hooks"
cp -R "${COMPILATIONS_DIR}/frontend" "${COMPILATIONS_DIR}/backend" "${WORK_DIR}/payload/"
# the hook brings the update and settings helpers and the service of this version onto the box
cp "${ROOT_DIR}/install/.assets/update-hooks/post-install.sh" "${ROOT_DIR}/install/.assets/scripts/buzzerbox-update.sh" \
  "${ROOT_DIR}/install/.assets/scripts/buzzerbox-settings.sh" \
  "${ROOT_DIR}/install/.assets/configs/systemd/buzzerbox-server.service" "${WORK_DIR}/payload/hooks/"
cp "${ROOT_DIR}/install/.assets/configs/sudoers/buzzerbox-settings" "${WORK_DIR}/payload/hooks/buzzerbox-settings.sudoers"
cp "${ROOT_DIR}/install/.assets/configs/nginx/sites-available-default.conf" "${WORK_DIR}/payload/hooks/nginx-site.conf"

# the extensions' files: only ones the core doesn't have, and no links, which could point anywhere on the box
if [ -n "${EXTRA_PAYLOAD}" ]; then
  if [ -n "$(find "${EXTRA_PAYLOAD}" -type l)" ]; then
    echo "BUZZERBOX_EXTRA_PAYLOAD has symbolic links, which a bundle must not have"
    exit 1
  fi
  while IFS= read -r -d '' file; do
    if [ -e "${WORK_DIR}/payload/${file#./}" ]; then
      echo "BUZZERBOX_EXTRA_PAYLOAD would replace the core's ${file#./}"
      exit 1
    fi
  done < <(cd "${EXTRA_PAYLOAD}" && find . -type f -print0)
  cp -R "${EXTRA_PAYLOAD}/." "${WORK_DIR}/payload/"
fi
chmod 755 "${WORK_DIR}/payload/hooks/"*.sh
if [ -d "${WORK_DIR}/payload/hooks/post-install.d" ]; then
  find "${WORK_DIR}/payload/hooks/post-install.d" -name '*.sh' -exec chmod 755 {} +
fi

# keep macOS metadata (._ files, extended attributes) out of the archives
export COPYFILE_DISABLE=1
# empty with GNU tar; expanded with ${…+…} below, since macOS's bash 3.2 calls an empty array unbound under set -u
TAR_OPTIONS=()
if tar --version | grep -q bsdtar; then
  TAR_OPTIONS=(--no-mac-metadata --no-xattrs)
fi
tar ${TAR_OPTIONS[@]+"${TAR_OPTIONS[@]}"} -czf "${WORK_DIR}/payload.tar.gz" -C "${WORK_DIR}/payload" .

PAYLOAD_SHA256="$(shasum -a 256 "${WORK_DIR}/payload.tar.gz" | cut -d' ' -f1)"
COMMIT="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)$(git -C "${ROOT_DIR}" diff --quiet HEAD || echo '-dirty')"
VERSION="${VERSION}" PAYLOAD_SHA256="${PAYLOAD_SHA256}" COMMIT="${COMMIT}" node -e '
  const manifest = {
    name: "buzzerbox",
    version: process.env.VERSION,
    payloadSha256: process.env.PAYLOAD_SHA256,
    commit: process.env.COMMIT,
    created: new Date().toISOString()
  };
  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
' > "${WORK_DIR}/manifest.json"
BUNDLE_FILES=(manifest.json payload.tar.gz)
if [ -n "${SIGNING_KEY}" ]; then
  node update-signing.js sign "${SIGNING_KEY}" "${WORK_DIR}/manifest.json" "${WORK_DIR}/manifest.sig"
  if [ -f "${PUBLIC_KEY}" ]; then
    node update-signing.js verify "${PUBLIC_KEY}" "${WORK_DIR}/manifest.json" "${WORK_DIR}/manifest.sig" \
      || { echo "The private key does not belong to ${PUBLIC_KEY}, so the boxes would refuse the bundle"; exit 1; }
  else
    echo "Warning: there is no public key at ${PUBLIC_KEY} to check the signature with"
  fi
  BUNDLE_FILES=(manifest.json manifest.sig payload.tar.gz)
fi

mkdir -p "${OUTPUT_DIR}"
BUNDLE="${OUTPUT_DIR}/buzzerbox-update-${VERSION}.tar"
tar ${TAR_OPTIONS[@]+"${TAR_OPTIONS[@]}"} -cf "${BUNDLE}" -C "${WORK_DIR}" "${BUNDLE_FILES[@]}"
if [ -n "${SIGNING_KEY}" ]; then
  echo "Created ${BUNDLE} (commit ${COMMIT}, signed)."
else
  echo "Created ${BUNDLE} (commit ${COMMIT}, NOT SIGNED: the box warns before installing it)."
fi
echo "Copy it into a folder named updates at the top level of a USB stick and plug the stick into the box."
