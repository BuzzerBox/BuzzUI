# hide the mouse cursor when idle
unclutter -idle 5
# open the page in kiosk mode: system's notifications are disabled as well as some other stuff
/usr/bin/chromium-browser --kiosk --disable-restore-session-state --disk-cache-dir=/dev/null --disk-cache-size=1  http://localhost/screen/
# start the server and write to logfile
# the following line should only be active while developing since it writes data to the card
node __INSTALL_DIR__/backend/server/main.js &>> server.log
#node /usr/local/buzzerbox/backend/server/main.js
# create the ad-hoc network to connect to the pi
sudo sh __INSTALL_DIR__/scripts/create-ad-hoc-network.sh
