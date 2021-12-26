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
# if a config file already exists, back it up
#ensureBackup "${NGINX_CONF_PATH}";
#if [ -f "${NGINX_CONF_PATH}" ]
#then
#  yes | sudo mv  "${NGINX_CONF_PATH}" "${NGINX_CONF_PATH}${BACKUP_FILE_NAME_POSTFIX}";
#fi
sudo mkdir -p "${NGINX_DIR}" -v
yes | sudo cp -f "${ASSETS_DIR}/configs/nginx/${NGINX_CONF_FILE}" "${NGINX_DIR}"
#sudo cp -f "${ASSETS_DIR}/configs/nginx/${NGINX_CONF_FILE}" "${NGINX_CONF_PATH}"
#sed -i "s/__INSTALL__DIR__/${INSTALL_DIR}/" "${NGINX_CONF_PATH}"
replaceInFile "${NGINX_DIR}" "__INSTALL__DIR__" "${INSTALL_DIR}";

echo "Copying BuzzerBox Frontend's files to nginx's serve folder..."
mkdir -p "${INSTALL_DIR}/frontend"
cp -r "${ASSETS_DIR}/compilations/frontend" "${INSTALL_DIR}"

echo "Installing and configuring hostapd and dnsmasq"
sudo apt-get install hostapd -y
sudo apt-get install dnsmasq -y
sudo systemctl unmask hostapd
sudo systemctl disable hostapd
sudo systemctl disable dnsmasq
# if a config file already exists, back it up
ensureBackup "${HOSTAPD_CONF_PATH}";
#if [ -f "${HOSTAPD_CONF_PATH}" ]
#then
#  yes | sudo mv  "${HOSTAPD_CONF_PATH}" "${HOSTAPD_CONF_PATH}${BACKUP_FILE_NAME_POSTFIX}";
#fi
sudo cp "${ASSETS_DIR}/configs/hostapd/hostapd.conf" "${HOSTAPD_CONF_PATH}"
#cat "${ASSETS_DIR}/configs/dnsmasq/dnsmasq.conf-appendix" | sudo tee -a "${DNSMASQ_CONF_PATH}"
appendContentToFile "${ASSETS_DIR}/configs/dnsmasq/dnsmasq.conf-appendix" "${DNSMASQ_CONF_PATH}";

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
  #  echo "${SERVER_IP_ADDRESS}      ${element}" | sudo tee -a "${HOSTS_FILE}";
  appendTextToFile "${SERVER_IP_ADDRESS}      ${HOSTNAMES_ARRAY[index]}" "${HOSTS_FILE}";
done
#echo "local=/local/" | sudo tee -a "${DNSMASQ_CONF_PATH}"
appendTextToFile "local=/local/" "${DNSMASQ_CONF_PATH}";
DEFAULT_HOSTAPD_FILE="/etc/default/hostapd"
#echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' | sudo tee -a "${DEFAULT_HOSTAPD_FILE}"
appendTextToFile 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' "${DEFAULT_HOSTAPD_FILE}";
#sed -i "s/__WIFI_SSID__/${__WIFI_SSID__}/" "${DEFAULT_HOSTAPD_FILE}"
#sed -i "s/__WIFI_PASSPHRASE__/${__WIFI_PASSPHRASE__}/" "${DEFAULT_HOSTAPD_FILE}"
#sed -i "s/__WIFI_COUNTRY_CODE__/${__WIFI_COUNTRY_CODE__}/" "${DEFAULT_HOSTAPD_FILE}"
replaceInFile "${DEFAULT_HOSTAPD_FILE}" "__WIFI_SSID__" "${WIFI_SSID}";
replaceInFile "${DEFAULT_HOSTAPD_FILE}" "__WIFI_PASSPHRASE__" "${WIFI_PASSPHRASE}";
replaceInFile "${DEFAULT_HOSTAPD_FILE}" "__WIFI_COUNTRY_CODE__" "${WIFI_COUNTRY_CODE}";

# enabling HMDI hot plug
BOOT_CONFIG_FILE="/boot/config.txt"
echo "Enabling HDMI hot-plug..."
#echo "hdmi_force_hotplug=1" | sudo tee -a "${BOOT_CONFIG_FILE}"
#echo "hdmi_group=1" | sudo tee -a "${BOOT_CONFIG_FILE}"
#echo "hdmi_mode=16" | sudo tee -a "${BOOT_CONFIG_FILE}"
# TODO use the function for config settings
appendTextToFile "hdmi_force_hotplug=1" "${BOOT_CONFIG_FILE}";
appendTextToFile "hdmi_group=1" "${BOOT_CONFIG_FILE}";
appendTextToFile "hdmi_mode=16" "${BOOT_CONFIG_FILE}";

# Disable screen saver
# https://stackoverflow.com/a/49405686/7618184
echo "Disabling screen saver/blanking..."
#echo "xserver-command=X -s 0 -p 0 -dpms" | sudo tee -a /etc/lightdm/lightdm.conf
appendTextToFile "xserver-command=X -s 0 -p 0 -dpms" "/etc/lightdm/lightdm.conf";

# Add custom boot logo
echo "Adding custom boot logo/splash screen..."
# see https://shop.sb-components.co.uk/blogs/posts/customising-splash-screen-on-your-raspberry-pi
# http://web.archive.org/web/20210925090045/https://shop.sb-components.co.uk/blogs/posts/customising-splash-screen-on-your-raspberry-pi
#echo "disable_splash=1" | sudo tee -a "${BOOT_CONFIG_FILE}"
appendTextToFile "disable_splash=1" "${BOOT_CONFIG_FILE}";
# todo is it ok to skip step with cmdline?
sudo apt install fbi -y
# TODO create path var
sudo mkdir -p /file/systemd/system
sudo cp "${ASSETS_DIR}/configs/splashscreen/splashscreen.service" /file/systemd/system/splashscreen.service
sudo cp "${ASSETS_DIR}/images/logo.png" "${SPLASH_IMAGE_TARGET_LOCATION}"
sudo apt-get update
sudo systemctl enable splashscreen


# Setting desktop background
# Thanks to chidwa @ https://raspberrypi.stackexchange.com/a/106023
echo "Setting the desktop background..."
pcmanfm --set-wallpaper "${SPLASH_IMAGE_TARGET_LOCATION}"

# hiding the panel/taskbar if not in use
echo "Hiding the lxpanel..."
#sudo sed -i 's/autohide=0/autohide=1/' /home/pi/.config/lxpanel/LXDE-pi/panels/panel
replaceInFile "/home/pi/.config/lxpanel/LXDE-pi/panels/panel" "autohide=0" "autohide=1";

# thanks to mleffler @ https://www.raspberrypi.org/forums/viewtopic.php?t=137124#p1546958
# disabling trash icon to clean up the desktop
echo "Cleaning up desktop by hiding unnecessary icons..."
# TODO use replaceInFile
sudo sed -i 's/show_trash=0/show_trash=1/' /home/pi/.config/pcmanfm/LXDE-pi/desktopps -items-0.conf
sudo sed -i 's/show_mounts=0/show_mounts=1/' /home/pi/.config/pcmanfm/LXDE-pi/desktop-items-0.conf

echo "Copying BuzzerBox Server's files to /usr/local/buzzerbox/backend..."
#mkdir -p /usr/local/buzzerbox
mkdir -p "${INSTALL_DIR}/backend"
cp -r "${ASSETS_DIR}/compilations/backend" "${INSTALL_DIR}"
#cp "${ASSETS_DIR}/raw/backend/server/package.json" "${INSTALL_DIR}/backend/server/package.json"
#npm --prefix "${INSTALL_DIR}/backend/server" i
#cd "../../"

#echo "Transpiling BuzzerBox Server's files to /usr/local/buzzerbox/backend..."
##mkdir -p /usr/local/buzzerbox/backend
#mkdir -p "${INSTALL_DIR}/backend"
#cd "${ASSETS_DIR}/raw/backend/server"
#npm i
##npx tsc --outDir "/usr/local/buzzerbox/backend"
#npx tsc --outDir "${INSTALL_DIR}/backend"
#cd "../../../../raspberry-pi-4/11-raspian-buster"

#cp -r "${ASSETS_DIR}/compilations/backend" /usr/local/buzzerbox


# install unclutter, to be able to hide mouse
sudo apt-get install unclutter -y

# if the autostart.sh directory does not exist, create it for user root
sudo mkdir -p "/etc/xdg/lxsession/LXDE-pi/autostart"

# copy the script that starts the ad-hoc wifi network
CREATE_AD_HOC_NETWORK_SCRIPT_TARGET_LOCATION="${INSTALL_DIR}/scripts/create-ad-hoc-network.sh"
echo "Copy script that will later start the ad-hoc wifi network..."
mkdir -p "${INSTALL_DIR}/scripts"
cp "${ASSETS_DIR}/scripts/create-ad-hoc-network.sh" "${CREATE_AD_HOC_NETWORK_SCRIPT_TARGET_LOCATION}"
sed -i "s|__SERVER_IP_ADDRESS__|${SERVER_IP_ADDRESS}|" "${CREATE_AD_HOC_NETWORK_SCRIPT_TARGET_LOCATION}"



# copy the autostart script
AUTOSTART_SCRIPT_LOCATION="/etc/xdg/lxsession/LXDE-pi/autostart"
echo "Copying autostart script..."
# TODO use the append to file function
cat "${ASSETS_DIR}/scripts/autostart.sh" | sudo tee "${AUTOSTART_SCRIPT_LOCATION}"
#cat "${ASSETS_DIR}/scripts/autostart.sh" | sudo tee -a "${AUTOSTART_SCRIPT_LOCATION}"
sed -i "s|__INSTALL_DIR__|${INSTALL_DIR}|" "${AUTOSTART_SCRIPT_LOCATION}"

# TODO activate overlay fs

# let the terminal stay open for debug purposes
read -p "Installation routine has finished. Press any key to reboot ..."

# reboot for changes to take effect
echo "Rebooting..."
sudo reboot
