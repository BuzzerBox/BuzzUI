#!/bin/sh

# TODO maybe set country, language, timezone?

# some configs
assetsRoot="../../.assets"

echo "Updating packe list..."
# update the package list
sudo apt-get update

# echo "upgrading all packages"
# upgrade all packages
#sudo apt-get upgrade
# disabled, because different version could lead to broken depedencies and stuff

echo "Creating temporary directory for downloaded and transpiled files..."
# create a temporary directory for files that may get downloaded during installation
mkdir "temp"

# thanks to https://linuxize.com/post/how-to-install-node-js-on-raspberry-pi/

echo "Adding latest stable NodeJS (14) repo to package lists..."
curl -sL https://deb.nodesource.com/setup_14.x | sudo bash -

echo "Installing NodeJS..."
sudo apt-get install nodejs -y

echo "Installing nginx..."
sudo apt-get install nginx -y
# shellcheck disable=SC2216
yes | cp -f "${assetsRoot}/configs/hostapd/hostapd.conf" /etc/nginx/sites-available/default

echo "Copying BuzzerBox Frontend's files to nginx's serve folder..."
mkdir -p /usr/local/buzzerbox/frontend
cp -r "${assetsRoot}/compilations/frontend" /usr/local/buzzerbox/frontend

echo "Installing and configuring hostapd and dnsmasq"
sudo apt-get install hostapd -y
sudo apt-get install dnsmasq -y
sudo systemctl unmask hostapd
sudo systemctl disable hostapd
sudo systemctl disable dnsmasq
sudo cp "${assetsRoot}/configs/hostapd/hostapd.conf" /etc/hostapd/hostapd.conf
cat "${assetsRoot}/configs/dnsmasq/dnsmasq.conf-appendix" | sudo tee -a /etc/dnsmasq.conf

echo "Add DNS entries to hosts file to make the BuzzerBox accessible via 'buzzer.box' and 'buzzerbox.local'"
echo "10.0.0.5      buzzer.box" | sudo tee -a /etc/hosts
echo "10.0.0.5      buzzerbox.local" | sudo tee -a /etc/hosts
echo "local=/local/" | sudo tee -a /etc/dnsmasq.conf
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' | sudo tee -a /etc/default/hostapd

# enabling HMDI hot plug
echo "Enabling HDMI hot-plug..."
echo "hdmi_force_hotplug=1" | sudo tee -a /boot/config.txt
echo "hdmi_group=1" | sudo tee -a /boot/config.txt
echo "hdmi_mode=16" | sudo tee -a /boot/config.txt

# Disable screen saver
# https://stackoverflow.com/a/49405686/7618184
echo "Disabling screen saver/blanking..."
echo "xserver-command=X -s 0 -p 0 -dpms" | sudo tee -a /etc/lightdm/lightdm.conf

# Add custom boot logo
echo "Adding custom boot logo/splash screen..."
# see https://shop.sb-components.co.uk/blogs/posts/customising-splash-screen-on-your-raspberry-pi
# http://web.archive.org/web/20210925090045/https://shop.sb-components.co.uk/blogs/posts/customising-splash-screen-on-your-raspberry-pi
echo "disable_splash=1" | sudo tee -a /boot/config.txt
# todo is it ok to skip step with cmdline?
sudo apt install fbi -y
sudo cp "${assetsRoot}/configs/splashscreen/splashscreen.service" /file/systemd/system/splashscreen.service
sudo cp "${assetsRoot}/images/logo.png" /home/pi/Pictures/splash.png
sudo apt-get update
sudo systemctl enable splashscreen


# Setting desktop background
# Thanks to chidwa @ https://raspberrypi.stackexchange.com/a/106023
echo "Setting the desktop background..."
pcmanfm --set-wallpaper /home/pi/Pictures/splash.png

# hiding the panel/taskbar if not in use
echo "Hiding the lxpanel..."
sudo sed -i 's/autohide=0/autohide=1/' /home/pi/.config/lxpanel/LXDE-pi/panels/panel

# thanks to mleffler @ https://www.raspberrypi.org/forums/viewtopic.php?t=137124#p1546958
# disabling trash icon to clean up the desktop
echo "Cleaning up desktop by hiding unnecessary icons..."
sudo sed -i 's/show_trash=0/show_trash=1/' /home/pi/.config/pcmanfm/LXDE-pi/desktop-items-0.conf
sudo sed -i 's/show_mounts=0/show_mounts=1/' /home/pi/.config/pcmanfm/LXDE-pi/desktop-items-0.conf

echo "Copying BuzzerBox Server's files to /usr/local/buzzerbox/backend..."
mkdir -p /usr/local/buzzerbox/backend
cp -r "${assetsRoot}/compilations/backend" /usr/local/buzzerbox/backend


# install unclutter, to be able to hide mouse
sudo apt-get install unclutter -y

# if the autostart.sh directory does not exist, create it for user root
sudo mkdir -p "/etc/xdg/lxsession/LXDE-pi/autostart"

# copy the script that starts the ad-hoc wifi network
echo "Copy script that will later start the ad-hoc wifi network..."
mkdir -p /usr/local/buzzerbox/scripts
cp "${assetsRoot}/scripts/create-ad-hoc-network.sh" /usr/local/buzzerbox/scripts/create-ad-hoc-network.sh

# copy the autostart script
echo "Copying autostart script..."
cat "${assetsRoot}/scripts/autostart.sh" | sudo tee -a /etc/xdg/lxsession/LXDE-pi/autostart

# TODO activate overlay fs

# let the terminal stay open for debug purposes
read

# reboot for changes to take effect
echo "Rebooting..."
sudo reboot
