# Installation Technical Info
Here you can find some background information about some task that are done during installation in order to make the
BuzzerBox work. The examples in here were created when everything was hard-coded and not configurable. If it is
configurable now, it will be stated so. Then the shown example can be used as a reference on how to achieve the goal,
but the actual result in the end may differ, depending on the `setup.env` file's settings during installation.

## Autostart
To auto start all the required stuff, make sure the following lines are present in  `/etc/xdg/lxsession/LXDE-pi/autostart`.
The installation directory is configurable now so the result in an actual installation may differ.
```
# hide the mouse cursor when idle
unclutter -idle 5
# open the page in kiosk mode: system's notifications are disabled as well as some other stuff
/usr/bin/chromium-browser --kiosk --disable-restore-session-state --disk-cache-dir=/dev/null --disk-cache-size=1  http://localhost/screen/
# start the server and write to logfile
# the following line should only be active while developing since it writes data to the card
# node /home/pi/buzzer/server/dist/server/main.js &>> server.log
node /home/pi/buzzer/server/dist/server/main.js
# create the ad-hoc network to connect to the pi
sudo sh /home/pi/buzzer/scripts/createAdHocNetwork.sh
```

## Splash Screen
To enable the custom splash screen, follow this tutorial: https://web.archive.org/web/20210308001512/https://scribles.net/customizing-boot-up-screen-on-raspberry-pi/

## DNS
To make the UI accessible via a domain name from the PiFi, configure /etc/hosts and add the lines
``` 
10.0.0.5      buzzer.box
10.0.0.5      buzzerbox.local
```

The hostnames are configurable now so the result in an actual installation may differ.

Additionally, configure /etc/dnsmasq.conf to resolve local DNS queries from the hosts file.
```
local=/local/
```
