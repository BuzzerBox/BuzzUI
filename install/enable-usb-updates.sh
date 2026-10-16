#!/bin/bash
# Sets a BuzzerBox up to install update bundles from USB sticks (see .assets/scripts/buzzerbox-update.sh):
# - moves the installation into ${INSTALL_DIR}/releases/<version> with ${INSTALL_DIR}/current pointing to it
# - runs the server as the systemd service buzzerbox-server instead of from the desktop autostart
# - installs the update helper, the public key that bundles are checked with and the sudo rule for the server
#
# install.sh runs this. To make a box that was installed before updates existed updatable, copy this install directory
# onto it and run this once as root. The box then still runs its old software, so install the first bundle by hand:
#   sudo buzzerbox-update install /media/pi/<stick>/buzzerbox-update-<version>.tar
# Running it again does no harm.

set -euo pipefail

cd "$(dirname "$0")"
ASSETS_DIR="$PWD/.assets"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script needs to be run as root!"
  exit 1
fi
if [ -f ./setup.env ]; then
  source ./setup.env
fi
INSTALL_DIR="${INSTALL_DIR:-/home/pi/BuzzerBox}"

NGINX_CONF="/etc/nginx/sites-available/default"
AUTOSTART_FILE="/etc/xdg/lxsession/LXDE-pi/autostart"
HELPER="/usr/local/sbin/buzzerbox-update"

if [ ! -L "${INSTALL_DIR}/current" ]; then
  if [ -d "${INSTALL_DIR}/backend" ]; then
    echo "Moving the installed software to ${INSTALL_DIR}/releases/legacy..."
    mkdir -p "${INSTALL_DIR}/releases/legacy"
    mv "${INSTALL_DIR}/frontend" "${INSTALL_DIR}/backend" "${INSTALL_DIR}/releases/legacy/"
    ln -sfn releases/legacy "${INSTALL_DIR}/current"
  else
    echo "There is no BuzzerBox installation in ${INSTALL_DIR}, run install.sh instead."
    exit 1
  fi
fi

echo "Installing the update helper..."
sed "s|__INSTALL_DIR__|${INSTALL_DIR}|g" "${ASSETS_DIR}/scripts/buzzerbox-update.sh" > "${HELPER}"
chmod 755 "${HELPER}"
mkdir -p /var/lib/buzzerbox /etc/buzzerbox /etc/sudoers.d
# the save games and media the master stores on the box (config.json: storage.boxPath)
mkdir -p /var/lib/buzzerbox/storage
chown pi:pi /var/lib/buzzerbox/storage
if [ -f "${ASSETS_DIR}/update-public-key.pem" ]; then
  install -m 644 "${ASSETS_DIR}/update-public-key.pem" /etc/buzzerbox/update-public-key.pem
else
  echo "WARNING: ${ASSETS_DIR}/update-public-key.pem is missing, so no update can be installed until it is in /etc/buzzerbox!"
fi
SUDOERS_TMP="$(mktemp)"
cp "${ASSETS_DIR}/configs/sudoers/buzzerbox-update" "${SUDOERS_TMP}"
visudo -cf "${SUDOERS_TMP}" > /dev/null
install -m 440 "${SUDOERS_TMP}" /etc/sudoers.d/buzzerbox-update
rm -f "${SUDOERS_TMP}"

echo "Serving the frontend from ${INSTALL_DIR}/current/frontend..."
sed -i "s|^\(\s*root\s\+\).*;|\1${INSTALL_DIR}/current/frontend;|" "${NGINX_CONF}"

echo "Running the server as the service buzzerbox-server..."
if [ -f "${AUTOSTART_FILE}" ]; then
  sed -i '/backend\/server\/main.js/d' "${AUTOSTART_FILE}"
fi
# the server that the desktop autostart started
pkill -f "${INSTALL_DIR}/backend/server/main.js" || true
sed "s|__INSTALL_DIR__|${INSTALL_DIR}|g" "${ASSETS_DIR}/configs/systemd/buzzerbox-server.service" \
  > /etc/systemd/system/buzzerbox-server.service
systemctl daemon-reload
systemctl enable buzzerbox-server
systemctl restart buzzerbox-server
systemctl reload nginx || systemctl restart nginx

echo "USB updates are enabled. Installed: $(basename "$(readlink "${INSTALL_DIR}/current")")"
