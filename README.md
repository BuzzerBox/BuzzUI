# BuzzUI
WebApp for the BuzzerBox

## Config
```json
{
  "gameName": <NAME>,
  "masterName": <NAME>,
  "screenName": <NAME>,
  "server": <SHOULD NOT BE CHANGED>
  "buzzers": [
    {
      "name": "Buzzer 1",
      "key": "Numpad0"
    }
    ...
    {
      "name": "Buzzer 5",
      "key": "Numpad4"
    }
  ],
  "i2c": {
    "addresses": {
     "microController": "25"
    },
    "commands": {
     "softRelease": "1",
     "setBuzzer": "2"
   }
  }
}
```
The following key-bindings are available so far: `NUMPAD_0`, `NUMPAD_1`, `NUMPAD_2`, `NUMPAD_3`, `NUMPAD_4`, `NUMPAD_5`, `NUMPAD_6`, `NUMPAD_7`, `NUMPAD_8`, `NUMPAD_9`.


# Autostart
To auto start all the required stuff, make sure the following lines are present in  `/etc/xdg/lxsession/LXDE-pi/autostart`
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

# Splash Screen
To enable the custom splash screen, follow this tutorial: https://web.archive.org/web/20210308001512/https://scribles.net/customizing-boot-up-screen-on-raspberry-pi/

# DNS 
To make the UI accessible via a domain name from the PiFi, configure /etc/hosts and add the line 
``` 
10.0.0.5      buzzer.box
10.0.0.5      buzzerbox.local
```

Additionally, configure /etc/dnsmasq.conf to resolve local DNS queries from the hosts file. 
```
local=/local/
```


# WiFi
WiFi name's `BuzzerBoxNetwork` and the password is `12TheBuzzerBox_IncredibleNetwork34`

# Disable Screen Saver
To disable the screen saver, use the `raspi-config` and disable the screen blanking
