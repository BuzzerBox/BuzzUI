#!/bin/bash

# test if at least INSTALL_DIR is set. If it is not, it is likely that the script was not called by the main install
# script but by the user directly
if [ -z "${INSTALL_DIR}" ]
then
  echo "DO NOT RUN THIS SCRIPT DIRECTLY! It needs to be run by the main install script in the root of this installation procedure!";
  exit;
fi

ASSETS_DIR="${ROOT_DIR}/.assets"

echo "Updating package list..."
# update the package list
sudo apt-get update

# echo "upgrading all packages"
# upgrade all packages
#sudo apt-get upgrade
# disabled, because different version could lead to broken dependencies and stuff

echo "Creating temporary directory for downloaded and transpiled files..."
# create a temporary directory for files that may get downloaded during installation
# TODO this dir is not used, is it?
mkdir "temp"

# thanks to https://linuxize.com/post/how-to-install-node-js-on-raspberry-pi/

echo "Adding latest stable NodeJS (14) repo to package lists..."
curl -sL https://deb.nodesource.com/setup_14.x | sudo bash -

echo "Installing NodeJS..."
sudo apt-get install nodejs -y

NGINX_CONF_PATH="${NGINX_DIR}/${NGINX_CONF_FILE}";

echo "Installing nginx..."
sudo apt-get install nginx -y
sudo mkdir -p "${NGINX_DIR}" -v
yes | sudo cp -f "${ASSETS_DIR}/configs/nginx/${NGINX_CONF_FILE}" "${NGINX_DIR}"
replaceInFile "${NGINX_DIR}" "__INSTALL_DIR__" "${INSTALL_DIR}";

# the release layout lets updates replace the software, see enable-usb-updates.sh
VERSION="$(node -e 'console.log(require(process.argv[1]).version)' "${ASSETS_DIR}/compilations/backend/version.json")"
echo "Copying BuzzerBox ${VERSION} to ${INSTALL_DIR}/releases/${VERSION}..."
mkdir -p "${INSTALL_DIR}/releases/${VERSION}"
# the backend comes with its node_modules (see scripts/create-installation-files.sh)
cp -r "${ASSETS_DIR}/compilations/frontend" "${ASSETS_DIR}/compilations/backend" "${INSTALL_DIR}/releases/${VERSION}/"
ln -sfn "releases/${VERSION}" "${INSTALL_DIR}/current"




echo "Installing and configuring hostapd and dnsmasq"
sudo apt-get install hostapd -y
sudo apt-get install dnsmasq -y
sudo systemctl unmask hostapd
sudo systemctl disable hostapd
sudo systemctl disable dnsmasq
# if a config file already exists, back it up
ensureBackup "${HOSTAPD_CONF_PATH}";
sudo cp "${ASSETS_DIR}/configs/hostapd/hostapd.conf" "${HOSTAPD_CONF_PATH}"
replaceInFile "${HOSTAPD_CONF_PATH}" "__WIFI_SSID__" "${WIFI_SSID}";
appendContentToFile "${ASSETS_DIR}/configs/dnsmasq/dnsmasq.conf-appendix" "${DNSMASQ_CONF_PATH}";
# hand out addresses in the /24 network of the server, see create-ad-hoc-network.sh
sudo sed -i "s|__SUBNET_PREFIX__|${SERVER_IP_ADDRESS%.*}|g" "${DNSMASQ_CONF_PATH}"

HOSTS_FILE="/etc/hosts"

# parse hostnames, thanks to Dennis Williamson @ https://stackoverflow.com/a/10586169/7618184
HOSTNAMES_CONSOLE_STRING=""

# TODO move to functions.sh as well?
# parse the env var into an array
IFS=';' read -r -a HOSTNAMES_ARRAY <<< "${HOSTNAMES}";

# create the info string that will be printed to console
for index in "${!HOSTNAMES_ARRAY[@]}"
do
  if [ "${index}" -ne 0 ]
  then
    HOSTNAMES_CONSOLE_STRING+=" and ";
  fi
  HOSTNAMES_CONSOLE_STRING+="'${HOSTNAMES_ARRAY[index]}'"
done
echo "Add DNS entries to hosts file to make the BuzzerBox accessible via ${HOSTNAMES_CONSOLE_STRING}"
# add the hostnames to the hosts file, line by line
for index in "${!HOSTNAMES_ARRAY[@]}"
do
  appendTextToFile "${SERVER_IP_ADDRESS}      ${HOSTNAMES_ARRAY[index]}" "${HOSTS_FILE}";
done
appendTextToFile "local=/local/" "${DNSMASQ_CONF_PATH}";
DEFAULT_HOSTAPD_FILE="/etc/default/hostapd"
appendTextToFile 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' "${DEFAULT_HOSTAPD_FILE}";
replaceInFile "${HOSTAPD_CONF_PATH}" "__WIFI_SSID__" "${WIFI_SSID}";
replaceInFile "${HOSTAPD_CONF_PATH}" "__WIFI_PASSPHRASE__" "${WIFI_PASSPHRASE}";
replaceInFile "${HOSTAPD_CONF_PATH}" "__WIFI_COUNTRY_CODE__" "${WIFI_COUNTRY_CODE}";
# in case the wifi is soft-blocked due to some reasong (e.g. not enabled by default when image was flashed) we need to unblock it
sudo rfkill unblock wifi

# enabling HMDI hot plug
BOOT_CONFIG_FILE="/boot/config.txt"
echo "Enabling HDMI hot-plug..."
# TODO use the function for config settings
appendTextToFile "hdmi_force_hotplug=1" "${BOOT_CONFIG_FILE}";
appendTextToFile "hdmi_group=1" "${BOOT_CONFIG_FILE}";
appendTextToFile "hdmi_mode=16" "${BOOT_CONFIG_FILE}";

# Add custom boot logo
echo "Adding custom boot logo/splash screen..."
# see https://shop.sb-components.co.uk/blogs/posts/customising-splash-screen-on-your-raspberry-pi
# http://web.archive.org/web/20210925090045/https://shop.sb-components.co.uk/blogs/posts/customising-splash-screen-on-your-raspberry-pi
appendTextToFile "disable_splash=1" "${BOOT_CONFIG_FILE}";
# todo is it ok to skip step with cmdline?
sudo apt install fbi -y
SPLASH_SERVICE_PATH="/etc/systemd/system/splashscreen.service"
sudo cp "${ASSETS_DIR}/configs/splashscreen/splashscreen.service" "${SPLASH_SERVICE_PATH}"
replaceInFile "${SPLASH_SERVICE_PATH}" "__SPLASH_IMAGE_TARGET_LOCATION__" "${SPLASH_IMAGE_TARGET_LOCATION}";
sudo mkdir -p "$(dirname "${SPLASH_IMAGE_TARGET_LOCATION}")"
sudo cp "${ASSETS_DIR}/images/logo.png" "${SPLASH_IMAGE_TARGET_LOCATION}"
sudo apt-get update
sudo systemctl enable splashscreen


# Setting desktop background
# Thanks to chidwa @ https://raspberrypi.stackexchange.com/a/106023
echo "Setting the desktop background..."
pcmanfm --set-wallpaper "${SPLASH_IMAGE_TARGET_LOCATION}"

# hiding the panel/taskbar if not in use
echo "Hiding the lxpanel..."
replaceInFile "/home/pi/.config/lxpanel/LXDE-pi/panels/panel" "autohide=0" "autohide=1";

# thanks to mleffler @ https://www.raspberrypi.org/forums/viewtopic.php?t=137124#p1546958
# disabling trash icon to clean up the desktop
echo "Cleaning up desktop by hiding unnecessary icons..."
DESKTOP_ITEMS_FILE="/home/pi/.config/pcmanfm/LXDE-pi/desktop-items-0.conf"
setInConfigFile "${DESKTOP_ITEMS_FILE}" "show_trash" "0";
setInConfigFile "${DESKTOP_ITEMS_FILE}" "show_mounts" "0";


# install unclutter, to be able to hide mouse
sudo apt-get install unclutter -y

# if the autostart.sh directory does not exist, create it for user root
sudo mkdir -p "/etc/xdg/lxsession/LXDE-pi/autostart"

# copy the script that starts the ad-hoc wifi network
CREATE_AD_HOC_NETWORK_SCRIPT_TARGET_LOCATION="${INSTALL_DIR}/scripts/create-ad-hoc-network.sh"
echo "Copy script that will later start the ad-hoc wifi network..."
mkdir -p "${INSTALL_DIR}/scripts"
cp "${ASSETS_DIR}/scripts/create-ad-hoc-network.sh" "${CREATE_AD_HOC_NETWORK_SCRIPT_TARGET_LOCATION}"
sudo chmod +x "${CREATE_AD_HOC_NETWORK_SCRIPT_TARGET_LOCATION}"
sed -i "s|__SERVER_IP_ADDRESS__|${SERVER_IP_ADDRESS}|" "${CREATE_AD_HOC_NETWORK_SCRIPT_TARGET_LOCATION}"



# copy the autostart script
AUTOSTART_SCRIPT_LOCATION="/etc/xdg/lxsession/LXDE-pi/autostart"
echo "Copying autostart script..."
# TODO use the append to file function
cat "${ASSETS_DIR}/scripts/autostart.sh" | sudo tee "${AUTOSTART_SCRIPT_LOCATION}"
sed -i "s|__INSTALL_DIR__|${INSTALL_DIR}|" "${AUTOSTART_SCRIPT_LOCATION}"

echo "Setting up the server service and USB updates..."
"${ROOT_DIR}/enable-usb-updates.sh"

# TODO activate overlay fs
# (updates need a writable ${INSTALL_DIR} and /var/lib/buzzerbox, see buzzerbox-update.sh)

# let the terminal stay open for debug purposes
read -p "Installation routine has finished. Press any key to reboot ..."

# reboot for changes to take effect
echo "Rebooting..."
sudo reboot
