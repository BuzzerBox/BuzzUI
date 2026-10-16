#!/bin/bash
# Part of every update bundle (see scripts/create-update-bundle.sh). buzzerbox-update runs it as root after it unpacked
# the bundle into releases/<version> and switched current to it, before it restarts the server. It gets INSTALL_DIR and
# PREVIOUS_VERSION from the environment.
#
# It brings the update helper and the server service of this version onto the box. They stay when an update is rolled
# back, so they have to keep working with older versions.

set -euo pipefail

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"

# a new file instead of overwriting the old one, since the running helper still reads from it
sed "s|__INSTALL_DIR__|${INSTALL_DIR}|g" "${HOOKS_DIR}/buzzerbox-update.sh" > /usr/local/sbin/buzzerbox-update.new
chmod 755 /usr/local/sbin/buzzerbox-update.new
mv -f /usr/local/sbin/buzzerbox-update.new /usr/local/sbin/buzzerbox-update

# the service file says User=pi, but a box set up with another user (buzzerbox_user in provisioning/) keeps its own
SERVICE_FILE=/etc/systemd/system/buzzerbox-server.service
SERVER_USER="$(sed -n 's/^User=//p' "${SERVICE_FILE}" 2> /dev/null | head -n 1)"
sed -e "s|__INSTALL_DIR__|${INSTALL_DIR}|g" -e "s|^User=.*|User=${SERVER_USER:-pi}|" "${HOOKS_DIR}/buzzerbox-server.service" \
  > "${SERVICE_FILE}"
systemctl daemon-reload
