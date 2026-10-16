#!/bin/bash
# Builds the BuzzerBox image for the SD card or the eMMC of a Raspberry Pi 4 / Compute Module 4, in a container. Needs
# Docker (Linux or macOS) and, unless --skip-compile is given, Node.js to build the client and the server.
#
#   provisioning/image/build.sh [--skip-compile] [--vars <ansible-vars-file>]
#
# --skip-compile uses install/.assets/compilations as it is. --vars passes extra Ansible variables, e.g. ssh_authorized_keys
# (see provisioning/group_vars/all.yml). The image lands in provisioning/image/out/.
# On an x86-64 machine, the arm64 chroot needs emulation first: docker run --privileged --rm tonistiigi/binfmt --install arm64

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPILATIONS_DIR="${ROOT_DIR}/install/.assets/compilations"
OUTPUT_DIR="${SCRIPT_DIR}/out"
BUILDER_IMAGE="buzzerbox-image-builder"

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

COMPILE=true
VARS_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-compile) COMPILE=false ;;
    --vars) [ $# -ge 2 ] || usage; VARS_FILE="$(realpath "$2")"; shift ;;
    *) usage ;;
  esac
  shift
done
if [ -n "${VARS_FILE}" ] && [[ "${VARS_FILE}" != "${ROOT_DIR}/"* ]]; then
  echo "The vars file has to be inside the repository, which is all the container sees"
  exit 1
fi

if [ "${COMPILE}" = true ]; then
  sh "${ROOT_DIR}/scripts/create-installation-files.sh"
fi
VERSION="$(node -p "require('${ROOT_DIR}/version.json').version" 2> /dev/null \
  || sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "${ROOT_DIR}/version.json")"
COMMIT="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)$(git -C "${ROOT_DIR}" diff --quiet HEAD -- . ':!install/.assets/compilations' || echo '-dirty')"
# the release keeps the plain version, which the update bundles compare with; the image name tells the commit
RELEASE_ARCHIVE="${OUTPUT_DIR}/buzzerbox-release-${VERSION}.tar.gz"

mkdir -p "${OUTPUT_DIR}"
export COPYFILE_DISABLE=1
TAR_OPTIONS=()
if tar --version | grep -q bsdtar; then
  TAR_OPTIONS=(--no-mac-metadata --no-xattrs)
fi
tar "${TAR_OPTIONS[@]}" -czf "${RELEASE_ARCHIVE}" -C "${COMPILATIONS_DIR}" frontend backend

docker build -t "${BUILDER_IMAGE}" "${SCRIPT_DIR}"
# the base image is cached in a volume, so it is only downloaded once
docker run --rm --privileged \
  -v "${ROOT_DIR}:/src" -v buzzerbox-image-cache:/cache -e CACHE_DIR=/cache -e "IMAGE_NAME=buzzerbox-${VERSION}-${COMMIT}" \
  "${BUILDER_IMAGE}" \
  /src/provisioning/image/build-image.sh "/src/${RELEASE_ARCHIVE#"${ROOT_DIR}/"}" /src/provisioning/image/out \
  ${VARS_FILE:+"/src/${VARS_FILE#"${ROOT_DIR}/"}"}
rm -f "${RELEASE_ARCHIVE}"
