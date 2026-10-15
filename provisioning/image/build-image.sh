#!/bin/bash
# Builds the BuzzerBox image: Raspberry Pi OS Lite (base-image.env), set up by the Ansible playbook in a chroot.
# Runs as root on an arm64 Linux machine (on x86-64 only with qemu-user-static for arm64), normally through build.sh.
#
#   build-image.sh <release-archive> <output-dir> [<ansible-vars-file>]
#
# The release archive (buzzerbox-release-<version>.tar.gz, made by build.sh) holds frontend/ and backend/. The image,
# its checksum and the list of its packages go to the output directory, named IMAGE_NAME (default
# buzzerbox-<version>). CACHE_DIR keeps the downloaded base image.

set -euo pipefail

RELEASE_ARCHIVE="$(realpath "$1")"
OUTPUT_DIR="$(realpath "$2")"
VARS_FILE="${3:+$(realpath "$3")}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROVISIONING_DIR="$(dirname "${SCRIPT_DIR}")"
CACHE_DIR="${CACHE_DIR:-${SCRIPT_DIR}/.cache}"
# room for the packages the playbook installs. The root partition fills the card on the first boot anyway.
EXTRA_ROOT_SIZE="${EXTRA_ROOT_SIZE:-2G}"
# shellcheck source=base-image.env
source "${SCRIPT_DIR}/base-image.env"

if [ "$(id -u)" -ne 0 ]; then
  echo "This needs to be run as root"
  exit 1
fi
VERSION="$(basename "${RELEASE_ARCHIVE}" .tar.gz)"
VERSION="${VERSION#buzzerbox-release-}"
IMAGE_NAME="${IMAGE_NAME:-buzzerbox-${VERSION}}"

log() {
  echo "==> $*"
}

BASE_IMAGE="${CACHE_DIR}/$(basename "${BASE_IMAGE_URL}")"
if ! echo "${BASE_IMAGE_SHA256}  ${BASE_IMAGE}" | sha256sum -c --status 2> /dev/null; then
  log "Downloading ${BASE_IMAGE_URL}"
  mkdir -p "${CACHE_DIR}"
  curl -fL --retry 3 -o "${BASE_IMAGE}.part" "${BASE_IMAGE_URL}"
  mv "${BASE_IMAGE}.part" "${BASE_IMAGE}"
  echo "${BASE_IMAGE_SHA256}  ${BASE_IMAGE}" | sha256sum -c
fi

WORK_DIR="$(mktemp -d /var/tmp/buzzerbox-image.XXXXXX)"
IMAGE="${WORK_DIR}/${IMAGE_NAME}.img"
ROOT="${WORK_DIR}/root"
ROOT_LOOP=""
BOOT_LOOP=""
cleanup() {
  if mountpoint -q "${ROOT}"; then
    umount -R "${ROOT}" || umount -Rl "${ROOT}"
  fi
  for loop in "${BOOT_LOOP}" "${ROOT_LOOP}"; do
    if [ -n "${loop}" ]; then
      losetup -d "${loop}" || true
    fi
  done
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

log "Unpacking the base image"
xz -dc "${BASE_IMAGE}" > "${IMAGE}"
truncate -s "+${EXTRA_ROOT_SIZE}" "${IMAGE}"
echo ", +" | sfdisk --quiet --no-reread --no-tell-kernel -N 2 "${IMAGE}"

# the partitions are attached by offset, since containers don't get the device nodes of partitioned loop devices
# partition::number -> prints "<offset> <size>" in bytes
partition() {
  sfdisk -J "${IMAGE}" | python3 -c '
import json, sys
table = json.load(sys.stdin)["partitiontable"]
part = table["partitions"][int(sys.argv[1]) - 1]
print(part["start"] * table.get("sectorsize", 512), part["size"] * table.get("sectorsize", 512))
' "$1"
}
read -r ROOT_OFFSET ROOT_SIZE <<< "$(partition 2)"
read -r BOOT_OFFSET BOOT_SIZE <<< "$(partition 1)"
ROOT_LOOP="$(losetup -f --show -o "${ROOT_OFFSET}" --sizelimit "${ROOT_SIZE}" "${IMAGE}")"
BOOT_LOOP="$(losetup -f --show -o "${BOOT_OFFSET}" --sizelimit "${BOOT_SIZE}" "${IMAGE}")"
log "Growing the root file system"
e2fsck -pf "${ROOT_LOOP}" || [ $? -le 1 ]
resize2fs "${ROOT_LOOP}"

mkdir -p "${ROOT}"
mount "${ROOT_LOOP}" "${ROOT}"
mount "${BOOT_LOOP}" "${ROOT}/boot/firmware"
mount --bind /dev "${ROOT}/dev"
mount --bind /dev/pts "${ROOT}/dev/pts"
mount -t proc proc "${ROOT}/proc"
mount -t sysfs sysfs "${ROOT}/sys"
mount -t tmpfs tmpfs "${ROOT}/tmp"

# name resolution for apt and the downloads, and no services starting from package scripts
mv "${ROOT}/etc/resolv.conf" "${ROOT}/etc/resolv.conf.buzzerbox" 2> /dev/null || true
cp -L /etc/resolv.conf "${ROOT}/etc/resolv.conf"
printf '#!/bin/sh\nexit 101\n' > "${ROOT}/usr/sbin/policy-rc.d"
chmod 755 "${ROOT}/usr/sbin/policy-rc.d"

log "Running the playbook"
ANSIBLE_ARGS=(-i "${ROOT}," -c community.general.chroot -e ansible_become=false
  -e "buzzerbox_release_archive=${RELEASE_ARCHIVE}")
if [ -n "${VARS_FILE}" ]; then
  ANSIBLE_ARGS+=(-e "@${VARS_FILE}")
fi
(cd "${PROVISIONING_DIR}" && SYSTEMD_OFFLINE=1 ansible-playbook "${ANSIBLE_ARGS[@]}" site.yml)

log "Cleaning up"
chroot "${ROOT}" apt-get clean
rm -rf "${ROOT}/var/lib/apt/lists/"* "${ROOT}/usr/sbin/policy-rc.d" "${ROOT}/root/.ansible" "${ROOT}/root/.cache"
rm -f "${ROOT}/etc/resolv.conf"
mv "${ROOT}/etc/resolv.conf.buzzerbox" "${ROOT}/etc/resolv.conf" 2> /dev/null || true
# each box creates its own on the first boot (the SSH host keys come from regenerate_ssh_host_keys.service)
: > "${ROOT}/etc/machine-id"
rm -f "${ROOT}/var/lib/dbus/machine-id" "${ROOT}/etc/ssh/ssh_host_"*
mkdir -p "${OUTPUT_DIR}"
chroot "${ROOT}" dpkg-query -W -f '${Package} ${Version} ${Architecture}\n' > "${OUTPUT_DIR}/${IMAGE_NAME}.packages.txt"
{
  echo "base image: ${BASE_IMAGE_URL} (sha256 ${BASE_IMAGE_SHA256})"
  echo "built: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "${OUTPUT_DIR}/${IMAGE_NAME}.packages.txt"
umount -R "${ROOT}"
e2fsck -pf "${ROOT_LOOP}" || [ $? -le 1 ]
# zero the free blocks so that they compress away
if command -v zerofree > /dev/null; then
  zerofree "${ROOT_LOOP}"
fi
losetup -d "${BOOT_LOOP}" "${ROOT_LOOP}"
BOOT_LOOP=""
ROOT_LOOP=""

log "Compressing the image"
xz -T0 -6 -c "${IMAGE}" > "${OUTPUT_DIR}/${IMAGE_NAME}.img.xz"
(cd "${OUTPUT_DIR}" && sha256sum "${IMAGE_NAME}.img.xz" > "${IMAGE_NAME}.img.xz.sha256")
log "Built ${OUTPUT_DIR}/${IMAGE_NAME}.img.xz"
