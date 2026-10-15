#!/bin/bash
# Builds a signed update bundle updates/buzzerbox-update-<version>.tar that a BuzzerBox installs from a USB stick.
# The version comes from version.json, so raise it first.
#   ./create-update-bundle.sh <private-key.pem>
# The key can also be passed as BUZZERBOX_UPDATE_SIGNING_KEY. Create one with: node update-signing.js generate-key
#
# The bundle holds manifest.json (version and checksum of the payload), its signature manifest.sig and payload.tar.gz,
# which is unpacked into releases/<version> on the box: frontend/, backend/ (with node_modules) and hooks/.

set -euo pipefail

SIGNING_KEY="${1:-${BUZZERBOX_UPDATE_SIGNING_KEY:-}}"
if [ -z "${SIGNING_KEY}" ] || [ ! -f "${SIGNING_KEY}" ]; then
  echo "Usage: $0 <private-key.pem>"
  exit 1
fi
SIGNING_KEY="$(cd "$(dirname "${SIGNING_KEY}")" && pwd)/$(basename "${SIGNING_KEY}")"

cd "$(dirname "$0")"
ROOT_DIR="$(cd .. && pwd)"
COMPILATIONS_DIR="${ROOT_DIR}/install/.assets/compilations"
OUTPUT_DIR="${ROOT_DIR}/updates"
VERSION="$(node -p "require('${ROOT_DIR}/version.json').version")"

sh ./create-installation-files.sh

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT
mkdir -p "${WORK_DIR}/payload/hooks"
cp -R "${COMPILATIONS_DIR}/frontend" "${COMPILATIONS_DIR}/backend" "${WORK_DIR}/payload/"
# the hook brings the update helper and the service of this version onto the box
cp "${ROOT_DIR}/install/.assets/update-hooks/post-install.sh" "${ROOT_DIR}/install/.assets/scripts/buzzerbox-update.sh" \
  "${ROOT_DIR}/install/.assets/configs/systemd/buzzerbox-server.service" "${WORK_DIR}/payload/hooks/"
chmod 755 "${WORK_DIR}/payload/hooks/"*.sh

# keep macOS metadata (._ files, extended attributes) out of the archives
export COPYFILE_DISABLE=1
TAR_OPTIONS=()
if tar --version | grep -q bsdtar; then
  TAR_OPTIONS=(--no-mac-metadata --no-xattrs)
fi
tar "${TAR_OPTIONS[@]}" -czf "${WORK_DIR}/payload.tar.gz" -C "${WORK_DIR}/payload" .

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
node update-signing.js sign "${SIGNING_KEY}" "${WORK_DIR}/manifest.json" "${WORK_DIR}/manifest.sig"

mkdir -p "${OUTPUT_DIR}"
BUNDLE="${OUTPUT_DIR}/buzzerbox-update-${VERSION}.tar"
tar "${TAR_OPTIONS[@]}" -cf "${BUNDLE}" -C "${WORK_DIR}" manifest.json manifest.sig payload.tar.gz
echo "Created ${BUNDLE} (commit ${COMMIT}). Copy it onto a USB stick (top level or any folder) and plug it into the box."
