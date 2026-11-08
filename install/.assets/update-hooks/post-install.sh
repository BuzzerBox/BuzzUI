#!/bin/bash
# Part of every update bundle (see scripts/create-update-bundle.sh). buzzerbox-update runs it as root after it unpacked
# the bundle into releases/<version> and switched current to it, before it restarts the server. It gets INSTALL_DIR and
# PREVIOUS_VERSION from the environment.
#
# It brings the update helper, the settings helper (with its sudo rule) and the server service of this version onto the
# box. They stay when an update is rolled back, so they have to keep working with older versions.

set -euo pipefail

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"

# a new file instead of overwriting the old one, since the running helper still reads from it
sed "s|__INSTALL_DIR__|${INSTALL_DIR}|g" "${HOOKS_DIR}/buzzerbox-update.sh" > /usr/local/sbin/buzzerbox-update.new
chmod 755 /usr/local/sbin/buzzerbox-update.new
mv -f /usr/local/sbin/buzzerbox-update.new /usr/local/sbin/buzzerbox-update

# the service file says User=pi, but a box set up with another user (buzzerbox_user in provisioning/) keeps its own
SERVICE_FILE=/etc/systemd/system/buzzerbox-server.service
SERVER_USER="$(sed -n 's/^User=//p' "${SERVICE_FILE}" 2> /dev/null | head -n 1)"

# the master shows and changes the settings in buzzerbox.txt through it (only boxes with that file use it)
cp "${HOOKS_DIR}/buzzerbox-settings.sh" /usr/local/sbin/buzzerbox-settings.new
chmod 755 /usr/local/sbin/buzzerbox-settings.new
mv -f /usr/local/sbin/buzzerbox-settings.new /usr/local/sbin/buzzerbox-settings
SUDOERS_TMP="$(mktemp)"
sed "s|^pi ALL|${SERVER_USER:-pi} ALL|" "${HOOKS_DIR}/buzzerbox-settings.sudoers" > "${SUDOERS_TMP}"
# a broken file in sudoers.d would break sudo altogether, so it is checked first
if visudo -cf "${SUDOERS_TMP}" > /dev/null; then
  chmod 440 "${SUDOERS_TMP}"
  mv -f "${SUDOERS_TMP}" /etc/sudoers.d/buzzerbox-settings
else
  rm -f "${SUDOERS_TMP}"
  echo "post-install: the sudo rule of the settings helper is invalid, the master can't change the settings" >&2
fi

# the save games and media the master stores on the box (config.json: storage.boxPath), for boxes from before it
mkdir -p /var/lib/buzzerbox/storage
chown "${SERVER_USER:-pi}:" /var/lib/buzzerbox/storage

sed -e "s|__INSTALL_DIR__|${INSTALL_DIR}|g" -e "s|^User=.*|User=${SERVER_USER:-pi}|" "${HOOKS_DIR}/buzzerbox-server.service" \
  > "${SERVICE_FILE}"
systemctl daemon-reload
