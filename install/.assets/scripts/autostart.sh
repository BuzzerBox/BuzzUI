# hide the mouse cursor when idle
unclutter -idle 5

# create the ad-hoc network to connect to the pi
sudo sh __INSTALL_DIR__/scripts/create-ad-hoc-network.sh
# the server runs as the systemd service buzzerbox-server

# open the page in kiosk mode: system's notifications are disabled as well as some other stuff
/usr/bin/chromium-browser --kiosk --autoplay-policy=no-user-gesture-required --disable-restore-session-state --disk-cache-dir=/dev/null --disk-cache-size=1  http://localhost/screen/
sudo sh __INSTALL_DIR__/scripts/click.sh
# disables the screensaver, thanks to Pete Kelley @ https://stackoverflow.com/a/58698636
sudo DISPLAY=:0 xset s 0
sudo DISPLAY=:0 xset -dpms
